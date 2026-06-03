import fetch from 'node-fetch'; // wait, it's ES module, node-fetch might not be installed, we can use built-in fetch! Node 18+ has built-in fetch.

async function test() {
  const url = 'https://pawchart-veterinary-system-341e.vercel.app/api/vets?clinic_id=6a15a44bd4710f4a24c02cf4';
  console.log("Fetching from production:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.slice(0, 1000));
  } catch (err) {
    console.error("Error:", err.message);
  }

  // Also check health
  try {
    const res = await fetch('https://pawchart-veterinary-system-341e.vercel.app/api/health');
    console.log("Health Status:", res.status);
    console.log("Health Response:", await res.text());
  } catch (err) {
    console.error("Health Error:", err.message);
  }

  process.exit(0);
}

test();
