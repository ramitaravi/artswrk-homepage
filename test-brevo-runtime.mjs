import { config } from 'dotenv';
config();

const key = process.env.BREVO_API_KEY;
console.log('Key present:', !!key);
if (key) console.log('Key prefix:', key.slice(0, 20) + '...');

try {
  const res = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': key, 'accept': 'application/json' }
  });
  const data = await res.json();
  console.log('Brevo response status:', res.status);
  console.log('Account email:', data.email ?? JSON.stringify(data).slice(0, 100));
} catch (e) {
  console.error('Fetch error:', e.message);
}
