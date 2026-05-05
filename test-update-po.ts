import { updateSupplierPOSchema } from './src/Purchases/schemas/purchases.schemas';

// Test avec différents payloads
const testCases = [
  {
    name: 'Mise à jour avec items',
    payload: {
      expected_delivery: '2026-05-15',
      notes: 'Test notes',
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174000',
          description: 'Test product',
          quantity_ordered: 10,
          unit_price_ht: 100.5,
          tax_rate_value: 19,
          sort_order: 0,
        },
      ],
    },
  },
  {
    name: 'Mise à jour sans items',
    payload: {
      expected_delivery: '2026-05-15',
      notes: 'Test notes',
    },
  },
  {
    name: 'Mise à jour avec date vide',
    payload: {
      expected_delivery: '',
      notes: 'Test notes',
    },
  },
  {
    name: 'Mise à jour avec date undefined',
    payload: {
      notes: 'Test notes',
    },
  },
];

console.log('Testing UpdateSupplierPODto validation:\n');

for (const testCase of testCases) {
  console.log(`\n📝 Test: ${testCase.name}`);
  console.log('Payload:', JSON.stringify(testCase.payload, null, 2));
  
  try {
    const result = updateSupplierPOSchema.parse(testCase.payload);
    console.log('✅ Validation passed');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('❌ Validation failed');
    console.log('Error:', error.errors || error.message);
  }
}
