import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

let ai: { generate: (prompt: string) => Promise<{ text: string }> } | null = null;
try {
  ai = (await import('@/ai/genkit')).ai;
} catch {
  // genkit not available (missing API key or module error) — fallback will be used
}

interface SalesData {
  totalSales?: number;
  totalAmount?: number;
  lowStock?: number;
  topCategories?: string[];
  recentSales?: number[];
  weekRevenue?: number;
  monthRevenue?: number;
}

// Retry only on 503 — any other error throws immediately
// Delays: 1s → 2s → 3s (exponential backoff)
async function generateWithRetry(prompt: string, maxAttempts = 3): Promise<string> {
  if (!ai) throw new Error('AI not available');
  const delays = [1000, 2000, 3000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await ai.generate(prompt);
      return response.text;
    } catch (error: any) {
      const is503 =
        error.message?.includes('503') ||
        error.status === 503 ||
        error.details?.includes('503');

      if (!is503) {
        console.error(`❌ AI non-503 error on attempt ${attempt + 1}:`, error.message);
        throw error;
      }

      if (attempt < maxAttempts - 1) {
        const waitMs = delays[attempt];
        console.warn(`⚠️ Gemini 503 on attempt ${attempt + 1}/${maxAttempts}. Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        console.error(`❌ AI failed after ${maxAttempts} attempts (503):`, error.message);
        throw error;
      }
    }
  }

  throw new Error('Unexpected: retry loop exhausted');
}

// Non-AI fallback — builds basic insight from structured sales data
function generateFallbackInsight(salesData?: SalesData): string {
  if (!salesData) {
    return 'System is running smoothly. Monitor your top categories and stock levels for continued growth.';
  }

  const { totalSales = 0, totalAmount = 0, lowStock = 0, topCategories = [] } = salesData;
  const parts: string[] = [];

  if (totalSales > 0) {
    parts.push(
      `Today ${totalSales} transaction${totalSales === 1 ? '' : 's'} completed with total revenue of Rs. ${totalAmount.toLocaleString()}.`
    );
  } else {
    parts.push('No sales recorded today yet.');
  }

  if (topCategories.length > 0) {
    parts.push(`Top performing categories: ${topCategories.slice(0, 3).join(', ')}.`);
  }

  parts.push(
    lowStock > 0
      ? `${lowStock} product${lowStock === 1 ? '' : 's'} running low on stock — restocking recommended.`
      : 'All stock levels are healthy.'
  );

  return parts.join(' ');
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'cashier', 'superadmin'])
  if (auth instanceof NextResponse) return auth

  let prompt: string | undefined;
  let salesData: SalesData | undefined;

  try {
    const body = await req.json();
    prompt    = body.prompt;
    salesData = body.salesData;
  } catch {
    return NextResponse.json(
      { success: false, insight: 'Invalid request body.', isAiGenerated: false },
      { status: 400 }
    );
  }

  if (!prompt && !salesData) {
    return NextResponse.json(
      { success: false, insight: 'No data provided.', isAiGenerated: false },
      { status: 400 }
    );
  }

  // Always inject business context — strict short output
  const aiPrompt = `You are a smart POS assistant for "Elites POS" in Pakistan.
RULES: Answer in maximum 2 short sentences. No bullet points. No markdown. No headings. Plain text only. Use Rs. for currency. Answer ONLY about this business data — never give general knowledge.

Business Data:
Today Revenue: Rs.${salesData?.totalAmount ?? 0} | Sales: ${salesData?.totalSales ?? 0} | Low Stock: ${salesData?.lowStock ?? 0} items | Top: ${salesData?.topCategories?.slice(0,3).join(', ') || 'none'} | Week: Rs.${salesData?.weekRevenue ?? 0} | Month: Rs.${salesData?.monthRevenue ?? 0}

Question: ${prompt ?? 'Give a one-line business summary.'}
Answer:`;

  try {
    const insightText = await generateWithRetry(aiPrompt);
    return NextResponse.json({
      success: true,
      insight: insightText,
      text: insightText,       // backward compatibility with existing frontend
      isAiGenerated: true,
    });
  } catch (error: any) {
    console.error('❌ AI Insight failed after all retries — using fallback:', error.message);
    const fallback = generateFallbackInsight(salesData);
    return NextResponse.json({
      success: true,
      insight: fallback,
      text: fallback,          // backward compatibility with existing frontend
      isAiGenerated: false,
    });
  }
}
