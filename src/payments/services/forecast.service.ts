// src/payments/services/forecast.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TransactionType } from '../enums/transaction-type.enum';

@Injectable()
export class ForecastService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async getCashFlowForecast(businessId: string): Promise<{
    historical: { date: string; inflow: number; outflow: number; balance: number }[];
    forecast: { date: string; predicted_balance: number }[];
    insight: string;
    advice: string[];
  }> {
    // 1. Fetch last 90 days of transactions
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const transactions = await this.transactionRepo
      .createQueryBuilder('t')
      .where('t.business_id = :businessId', { businessId })
      .andWhere('t.transaction_date >= :from', { from: ninetyDaysAgo.toISOString().split('T')[0] })
      .orderBy('t.transaction_date', 'ASC')
      .getMany();

    // 2. Group by date
    const grouped: Record<string, { inflow: number; outflow: number }> = {};
    for (const tx of transactions) {
      const date = String(tx.transaction_date).split('T')[0];
      if (!grouped[date]) grouped[date] = { inflow: 0, outflow: 0 };
      if (tx.type === TransactionType.ENCAISSEMENT) {
        grouped[date].inflow += Number(tx.amount);
      } else {
        grouped[date].outflow += Number(tx.amount);
      }
    }

    // 3. Build historical array with running balance
    let runningBalance = 0;
    const historical = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { inflow, outflow }]) => {
        runningBalance += inflow - outflow;
        return { date, inflow, outflow, balance: Math.round(runningBalance * 1000) / 1000 };
      });

    // 4. Build summary for Gemini prompt
    const totalInflow = historical.reduce((s, d) => s + d.inflow, 0);
    const totalOutflow = historical.reduce((s, d) => s + d.outflow, 0);
    const avgDailyInflow = totalInflow / 90;
    const avgDailyOutflow = totalOutflow / 90;
    const currentBalance = runningBalance;
    const netDaily = avgDailyInflow - avgDailyOutflow;
    const daysUntilEmpty =
      netDaily < 0 ? Math.floor(currentBalance / Math.abs(netDaily)) : null;

    const summary = `
Business cash flow summary (last 90 days):
- Total inflow: ${totalInflow.toFixed(3)} TND
- Total outflow: ${totalOutflow.toFixed(3)} TND
- Average daily inflow: ${avgDailyInflow.toFixed(3)} TND
- Average daily outflow: ${avgDailyOutflow.toFixed(3)} TND
- Current balance: ${currentBalance.toFixed(3)} TND
- Net daily cash flow: ${netDaily.toFixed(3)} TND
- Days until balance reaches zero (if trend continues): ${daysUntilEmpty ?? 'N/A (positive trend)'}
- Number of transactions: ${transactions.length}
    `.trim();

    // 5. Call Gemini API
    const apiKey = process.env.AchrafGeminiKey;
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a financial advisor AI for a Tunisian SaaS business platform.
Based on this cash flow data, do three things:
1. Predict the daily balance for the next 30 days as a JSON array of objects with keys "date" (YYYY-MM-DD starting from tomorrow) and "predicted_balance" (number).
2. Write a short 2-3 sentence insight in English summarizing the overall cash flow trend.
3. Write exactly 3 actionable financial advice tips in English, each as a short sentence starting with a verb (e.g. "Reduce...", "Consider...", "Avoid..."). Make them specific to the numbers provided.

${summary}

Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{
  "forecast": [{"date": "YYYY-MM-DD", "predicted_balance": 0}],
  "insight": "...",
  "advice": ["tip 1", "tip 2", "tip 3"]
}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1800 },
        }),
      },
    );

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // 6. Parse Gemini response safely
    let forecast: { date: string; predicted_balance: number }[] = [];
    let insight = 'Unable to generate insight at this time.';
    let advice: string[] = [];

    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      forecast = parsed.forecast ?? [];
      insight = parsed.insight ?? insight;
      advice = Array.isArray(parsed.advice) ? parsed.advice : [];
    } catch {
      const dailyNet = avgDailyInflow - avgDailyOutflow;
      forecast = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        return {
          date: date.toISOString().split('T')[0],
          predicted_balance: Math.round((currentBalance + dailyNet * (i + 1)) * 1000) / 1000,
        };
      });
      insight = `Based on your last 90 days, your average daily net is ${netDaily.toFixed(3)} TND. Current balance is ${currentBalance.toFixed(3)} TND.`;
      advice = [
        'Monitor your daily outflows to avoid unexpected shortfalls.',
        'Ensure inflow sources are consistent and diversified.',
        'Review large transactions regularly to detect anomalies.',
      ];
    }

    return { historical, forecast, insight, advice };
  }
}
