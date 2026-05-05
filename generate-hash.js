// generate-hash.js
const bcrypt = require('bcrypt');

const password = 'SuperSecure123!@#';

bcrypt.hash(password, 12).then(hash => {
  console.log('\n✅ Generated bcrypt hash for password:', password);
  console.log('\n📋 Copy this hash:');
  console.log(hash);
  console.log('\n📝 SQL Update Query:');
  console.log(`UPDATE public.platform_admins 
SET password_hash = '${hash}'
WHERE email = 'admin@noventra.com';`);
  console.log('\n');
}).catch(err => {
  console.error('Error:', err);
});
