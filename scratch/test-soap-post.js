import 'dotenv/config';

async function testSoapPost() {
  const payload = {
    transcript: "Buddy has persistent scratching of left ear, pyrexia, and dark waxy discharge for three days. Appetite reduced, susti (lethargy) present. Left ear canal is erythematous with waxy debris. Tympanic membrane intact. We diagnosed Otitis Externa. Plan: Otomax ear drops, 4 drops left ear twice daily for 7 days. Soft chicken and rice bland diet for recovery. Recheck in 14 days.",
    appointment_id: "66504a3ccb88a8f11880cafe",
    duration_seconds: 130
  };

  console.log("=================== 🧪 TESTING END-TO-END SOAP GENERATION POST ===================");
  console.log("📡 URL: http://localhost:5000/api/ai/process-transcript");
  console.log("📦 Body:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch("http://localhost:5000/api/ai/process-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log(`\n📥 Response Status: ${res.status} ${res.statusText}`);
    const result = await res.json();
    console.log("\n📥 Response Body:");
    console.log(JSON.stringify(result, null, 2));
    console.log("=================== 🧪 SOAP POST VERIFICATION END ===================\n");
  } catch (err) {
    console.error("❌ SOAP POST Fetch failed:", err.message);
  }
}

testSoapPost();
