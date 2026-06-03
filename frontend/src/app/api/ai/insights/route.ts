import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

async function generateWithRetry(prompt: string, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.generate(prompt);
      return response;
    } catch (error: any) {
      const is503 = error.message?.includes('503') || error.details?.includes('503');
      if (is503 && i < retries - 1) {
        console.warn(`⚠️ Gemini busy (503). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const response = await generateWithRetry(prompt);

    if (!response) {
      return NextResponse.json({ error: 'AI service unavailable, please try again later.' }, { status: 503 });
    }

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('❌ AI API Route Error:', error);

    const is503 = error.message?.includes('503') || error.details?.includes('503');
    if (is503) {
      return NextResponse.json({
        error: 'AI service is currently busy. Please try again in a few seconds.'
      }, { status: 503 });
    }

    return NextResponse.json({
      error: 'AI Insight failed',
      details: error.message
    }, { status: 500 });
  }
}
