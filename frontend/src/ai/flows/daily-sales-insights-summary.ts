import { z } from 'zod';
import { ai } from '@/ai/genkit';

const InputSchema = z.object({
  date: z.string(),
  totalSalesAmount: z.number(),
  numberOfTransactions: z.number(),
  averageTransactionValue: z.number(),
  topSellingProducts: z.array(z.string()),
  leastSellingProducts: z.array(z.string()),
  totalDiscountsApplied: z.number(),
  paymentMethodBreakdown: z.record(z.number()),
  newCustomersCount: z.number(),
  repeatCustomersCount: z.number(),
});

const OutputSchema = z.object({
  summary: z.string(),
});

export const dailySalesInsightsSummary = ai.defineFlow(
  {
    name: 'dailySalesInsightsSummary',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const prompt = `
You are a retail business analyst for a POS system. Analyze the following daily sales data and provide a concise 2-3 sentence business insight in English. Be professional, highlight one key positive and one area to improve.

Date: ${input.date}
Total Revenue: Rs. ${input.totalSalesAmount.toLocaleString()}
Total Transactions: ${input.numberOfTransactions}
Average Transaction Value: Rs. ${input.averageTransactionValue.toLocaleString()}
Top Selling Products: ${input.topSellingProducts.slice(0, 5).join(', ') || 'N/A'}
Least Selling Products: ${input.leastSellingProducts.slice(0, 3).join(', ') || 'N/A'}
Total Discounts Applied: Rs. ${input.totalDiscountsApplied.toLocaleString()}
Payment Methods: ${Object.entries(input.paymentMethodBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A'}
New Customers: ${input.newCustomersCount}
Repeat Customers: ${input.repeatCustomersCount}
    `.trim();

    const response = await ai.generate(prompt);

    return {
      summary: response.text,
    };
  }
);
