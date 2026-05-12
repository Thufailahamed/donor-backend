import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const host = process.env.REDIS_HOST;
const key = process.env.REDIS_KEY?.trim();

if (!host || !key) {
  console.error('❌ Missing REDIS_HOST or REDIS_KEY in .env');
  process.exit(1);
}

async function testAuth(username: string | undefined) {
  console.log(`\n--- Testing Auth with username: [${username || 'none'}] ---`);
  const client = new Redis({
    host,
    port: 6380,
    username,
    password: key,
    tls: {},
    retryStrategy: () => null, // Don't retry
  });

  try {
    await client.ping();
    console.log(`✅ SUCCESS! Username "${username || 'none'}" works.`);
    await client.quit();
    return true;
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    await client.quit();
    return false;
  }
}

async function run() {
  if (!host || !key) return; // redundant but satisfies TS
  console.log(`Target Host: ${host}`);
  console.log(`Target Key: ${key.substring(0, 5)}... (Length: ${key.length})`);

  const results = [
    await testAuth(undefined),   // No username
    await testAuth('default'),   // Default username
    await testAuth('donorsummit') // Cache name as username
  ];

  if (results.some(r => r)) {
    console.log('\n✨ We found a working configuration! Tell me which one succeeded.');
  } else {
    console.log('\n❌ None of the common combinations worked. Please double-check the Primary Key in Azure.');
  }
}

run();
