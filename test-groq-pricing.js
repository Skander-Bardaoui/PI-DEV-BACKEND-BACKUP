// Quick test script to verify Groq API integration for AI Pricing
// Run with: node test-groq-pricing.js

require('dotenv').config();

// Temporarily enable TLS verification for this test
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY not found in .env file');
  process.exit(1);
}

console.log('✅ GROQ_API_KEY found:', GROQ_API_KEY.substring(0, 10) + '...');

const testData = {
  targetRevenue: 100000,
  tenants: 50,
  growthRate: 20,
  currentPrice: 99
};

const prompt = `You are a SaaS pricing expert.

Based on the following data:
- Target annual revenue: $${testData.targetRevenue.toLocaleString()}
- Number of tenants: ${testData.tenants}
- Expected growth rate: ${testData.growthRate}%
- Current monthly price: $${testData.currentPrice}

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

async function testGroqPricing() {
  console.log('\n📡 Testing Groq API for AI Pricing...\n');
  console.log('Test Data:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
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
      console.error('❌ Groq API error:', errorText);
      process.exit(1);
    }

    const completion = await response.json();
    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      console.error('❌ Empty response from Groq API');
      process.exit(1);
    }

    console.log('\n✅ Groq API Response:\n');
    console.log(responseText);
    
    // Try to parse the JSON
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '');
    }
    cleanedText = cleanedText.trim();
    
    const parsed = JSON.parse(cleanedText);
    
    console.log('\n✅ Parsed Response:\n');
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log('\n✅ Test successful! AI Pricing with Groq API is working correctly.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testGroqPricing();
