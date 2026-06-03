import fetch from 'node-fetch';

async function testDashboard() {
  const url = 'https://pawchart-veterinary-system-341e.vercel.app/api/dashboard?clinic_id=6a15a44bd4710f4a24c02cf4';
  console.log("Fetching dashboard from production:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Dashboard Stats:", JSON.stringify(json.stats, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

testDashboard();
