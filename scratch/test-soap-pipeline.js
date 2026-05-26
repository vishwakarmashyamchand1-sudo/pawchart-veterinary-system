import 'dotenv/config';

async function auditAllModels() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("❌ GEMINI_API_KEY is missing from process.env!");
    return;
  }

  // 1. Fetch available models
  let permittedModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`);
    const listData = await listRes.json();
    if (listData.models) {
      permittedModels = listData.models.map(m => m.name.replace('models/', ''));
    }
  } catch (err) {
    console.error("⚠️ Failed to list models:", err.message);
    return;
  }

  console.log("📋 PERMITTED MODELS DETECTED FOR YOUR KEY:", permittedModels);
  console.log("🔬 TESTING EACH MODEL FOR ACTIVE QUOTA AND AVAILABILITY...\n");

  const testModels = permittedModels.filter(m => m.includes('flash') || m.includes('pro')).slice(0, 5);

  for (const modelName of testModels) {
    console.log(`\n--- Testing Model: ${modelName} ---`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello from PawChart, are you active?" }] }]
        })
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`✅ SUCCESS [200]: Model ${modelName} is ACTIVE and has quota!`);
        console.log(`💬 Response: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
      } else {
        console.warn(`❌ FAILED [${res.status}]: Model ${modelName} returned error:`);
        console.warn(data.error?.message || JSON.stringify(data));
      }
    } catch (err) {
      console.error(`❌ ERROR: Failed to make request for ${modelName}:`, err.message);
    }
  }
}

auditAllModels();
