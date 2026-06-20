import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

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

export async function POST(req: Request) {
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

  // Build prompt from salesData if no explicit prompt provided
  const aiPrompt = prompt ?? `
    As a POS System Business Analyst, provide a concise (2-3 sentences) daily summary:
    - Today's Revenue: Rs. ${salesData?.totalAmount ?? 0}
    - Today's Sales: ${salesData?.totalSales ?? 0}
    - Low Stock Items: ${salesData?.lowStock ?? 0}
    - Top Categories: ${salesData?.topCategories?.join(', ') || 'N/A'}
    Highlight one positive trend and one area that needs attention. Be professional and encouraging.
  `;

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
