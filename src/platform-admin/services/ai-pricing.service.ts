// src/platform-admin/services/ai-pricing.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiPricingRequestDto, AiPricingResponse } from '../dto/ai-pricing.dto';

@Injectable()
export class AiPricingService {
  private readonly logger = new Logger(AiPricingService.name);
  private groqApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY not configured. AI Pricing Assistant will not work.');
    } else {
      this.logger.log('Groq API key configured successfully');
    }
  }

  async generatePricingSuggestion(data: AiPricingRequestDto): Promise<AiPricingResponse> {
    if (!this.groqApiKey) {
      throw new BadRequestException('Groq API is not configured. Please add GROQ_API_KEY to environment variables.');
    }

    this.logger.log('Received pricing request:', JSON.stringify(data));

    try {
      const prompt = this.buildPrompt(data);
      
      this.logger.log('Calling Groq API for pricing suggestion...');
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a SaaS pricing expert. Always respond with valid JSON only, no additional text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Groq API error:', errorText);
        throw new Error(`Groq API request failed: ${response.status} ${response.statusText}`);
      }

      const completion = await response.json();
      const responseText = completion.choices[0]?.message?.content;
      
      if (!responseText) {
        throw new Error('Empty response from Groq API');
      }

      this.logger.log('Received response from Groq API');
      
      // Parse the JSON response
      const parsedResponse = this.parseAiResponse(responseText);
      
      return parsedResponse;
    } catch (error: any) {
      this.logger.error('Error calling Groq API:', error);
      this.logger.error('Error details:', {
        message: error?.message,
        status: error?.status,
      });
      
      if (error?.message?.includes('API key') || error?.message?.includes('401')) {
        throw new BadRequestException('Invalid Groq API key');
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to generate pricing suggestion. Please try again.');
    }
  }

  private buildPrompt(data: AiPricingRequestDto): string {
    return `You are a SaaS pricing expert.

Based on the following data:
- Target annual revenue: $${data.targetRevenue.toLocaleString()}
- Number of tenants: ${data.tenants}
- Expected growth rate: ${data.growthRate}%
- Current monthly price: $${data.currentPrice}

Suggest:
1. Optimal monthly subscription price
2. Optimal annual subscription price (with typical 15-20% discount)
3. Estimated yearly revenue based on your suggested pricing
4. Estimated retention rate (percentage)
5. Short explanation of the reasoning

Keep the answer structured in JSON format like:
{
  "monthlyPrice": number,
  "annualPrice": number,
  "predictedRevenue": number,
  "retentionRate": number,
  "explanation": string
}

Important:
- Consider market standards for SaaS pricing
- Annual price should be 10-12 months worth of monthly price (15-20% discount)
- Retention rate should be realistic (typically 70-95% for SaaS)
- Explanation should be concise (2-3 sentences)
- Return ONLY the JSON object, no additional text`;
  }

  private parseAiResponse(responseText: string): AiPricingResponse {
    try {
      // Remove markdown code blocks if present
      let cleanedText = responseText.trim();
      
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '');
      }
      
      cleanedText = cleanedText.trim();
      
      const parsed = JSON.parse(cleanedText);
      
      // Validate the response structure
      if (
        typeof parsed.monthlyPrice !== 'number' ||
        typeof parsed.annualPrice !== 'number' ||
        typeof parsed.predictedRevenue !== 'number' ||
        typeof parsed.retentionRate !== 'number' ||
        typeof parsed.explanation !== 'string'
      ) {
        throw new Error('Invalid response structure from AI');
      }
      
      // Ensure values are positive
      if (
        parsed.monthlyPrice <= 0 ||
        parsed.annualPrice <= 0 ||
        parsed.predictedRevenue <= 0 ||
        parsed.retentionRate <= 0 ||
        parsed.retentionRate > 100
      ) {
        throw new Error('Invalid values in AI response');
      }
      
      return {
        monthlyPrice: Math.round(parsed.monthlyPrice * 100) / 100,
        annualPrice: Math.round(parsed.annualPrice * 100) / 100,
        predictedRevenue: Math.round(parsed.predictedRevenue * 100) / 100,
        retentionRate: Math.round(parsed.retentionRate * 100) / 100,
        explanation: parsed.explanation,
      };
    } catch (error) {
      this.logger.error('Error parsing AI response:', error);
      this.logger.error('Raw response:', responseText);
      throw new BadRequestException('Failed to parse AI response. Please try again.');
    }
  }
}
