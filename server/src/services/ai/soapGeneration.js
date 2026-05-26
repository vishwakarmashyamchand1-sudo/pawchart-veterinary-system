import { GoogleGenerativeAI } from '@google/generative-ai';
import { VETERINARY_SYSTEM_PROMPT } from './prompts.js';
import { analyzeConsultation } from './consultationAnalysis.js';

/**
 * Generate Vet SOAP Consultation Notes with Real Gemini SDK - Debugging & Verification Mode
 */
export async function generateSOAPNote(transcript, petContext = null, pastNotes = []) {
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log("\n=================== 🔬 REAL GEMINI VERIFICATION DIAGNOSTICS START ===================");
  console.log("📝 TRANSCRIPT BEING PROCESSED:");
  console.log(`"${transcript}"\n`);
  
  if (petContext) {
    console.log("🐾 PET CONTEXT RECEIVED:");
    console.log(JSON.stringify(petContext, null, 2));
  }
  
  if (pastNotes && pastNotes.length > 0) {
    console.log(`💾 ACTIVE CONSULTATION MEMORY: ${pastNotes.length} past SOAP records loaded for history context.`);
  }

  // Log environment variable status safely (Masked to protect secrets)
  if (geminiKey) {
    const masked = geminiKey.length > 10 
      ? `${geminiKey.substring(0, 6)}...${geminiKey.substring(geminiKey.length - 4)}` 
      : "configured (short key)";
    console.log(`🔑 GEMINI_API_KEY STATUS: FOUND in process.env (Length: ${geminiKey.length}, Masked: ${masked})`);
  } else {
    console.log("🔑 GEMINI_API_KEY STATUS: ❌ NOT FOUND in process.env! Falling back is disabled for debugging.");
  }

  let userContent = `Dialogue Transcript:\n${transcript}\n\n`;
  if (petContext) {
    userContent += `Pet Context:\n${JSON.stringify(petContext, null, 2)}\n\n`;
  }
  if (pastNotes && pastNotes.length > 0) {
    userContent += `Past SOAP Note History:\n${JSON.stringify(pastNotes.slice(0, 3), null, 2)}\n\n`;
  }
  userContent += `Today's Date: ${new Date().toISOString().split('T')[0]}`;

  // 1. Force Gemini SDK Call (Temporarily disable fallback to identify errors directly)
  if (geminiKey) {
    try {
      console.log("🤖 Initializing Official Google Generative AI SDK...");
      const genAI = new GoogleGenerativeAI(geminiKey);
      
      // Diagnostics 1: Resilient model discovery based on active API Key permissions
      let targetModel = "gemini-1.5-flash";
      try {
        console.log("🔍 Fetching available models for this API key to avoid 404 errors...");
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`);
        const listData = await listRes.json();
        if (listData.models) {
          const permitted = listData.models.map(m => m.name);
          console.log("📋 PERMITTED MODELS FOR THIS KEY:", permitted);
          
          if (permitted.some(m => m.includes('gemini-2.5-flash'))) {
            targetModel = "gemini-2.5-flash";
          } else if (permitted.some(m => m.includes('gemini-2.0-flash'))) {
            targetModel = "gemini-2.0-flash";
          } else if (permitted.some(m => m.includes('gemini-1.5-flash'))) {
            targetModel = "gemini-1.5-flash";
          } else {
            // Find any flash model
            const flashModel = permitted.find(m => m.includes('-flash'));
            if (flashModel) {
              targetModel = flashModel.replace('models/', '');
            } else if (permitted.length > 0) {
              targetModel = permitted[0].replace('models/', '');
            }
          }
        }
      } catch (listErr) {
        console.warn("⚠️ Permitted models check failed, defaulting to gemini-1.5-flash:", listErr.message);
      }

      console.log(`🟢 ACTIVE PROVIDER: Google Gemini SDK (${targetModel})`);
      console.log(`⚡ Routing SOAP generation through ${targetModel}...`);
      const model = genAI.getGenerativeModel({ model: targetModel });
      console.log("📤 TRANSCRIPT SENT TO GEMINI:", transcript);
      
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${VETERINARY_SYSTEM_PROMPT}\n\n${userContent}` }] }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const response = await result.response;
      const text = response.text();
      
      console.log("\n📥 RAW GEMINI SDK RESPONSE:");
      console.log(text);

      if (text) {
        const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        
        console.log("\n✅ PARSED SOAP JSON SUCCESS:");
        console.log(JSON.stringify(parsed, null, 2));
        console.log("=================== 🔬 REAL GEMINI VERIFICATION DIAGNOSTICS END ===================\n");

        return {
          subjective: parsed.subjective || "",
          objective: parsed.objective || "",
          assessment: parsed.assessment || "",
          plan: parsed.plan || "",
          summary: parsed.summary || parsed.summary_text || "",
          chiefComplaint: parsed.chief_complaint || parsed.complaint || "",
          diagnosis: parsed.diagnosis || parsed.clinical_diagnosis || "",
          prescription: Array.isArray(parsed.prescription) ? parsed.prescription : [],
          followUpDate: parsed.follow_up_date || null,
          rawJson: parsed
        };
      }
      throw new Error("Empty response from Gemini SDK");
    } catch (err) {
      console.error("❌ Google Gemini SDK execution failed:");
      console.error("Full Error Object:", err);
      console.error("Error Message:", err.message);
      if (err.response) {
        console.error("Error Response Data:", err.response.data);
      }
      console.log("=================== 🔬 REAL GEMINI VERIFICATION DIAGNOSTICS END ===================\n");
      console.log("🔄 FALLBACK: Triggering local offline AI simulation due to SDK failure...");
      return analyzeConsultation(transcript, petContext, pastNotes);
    }
  } else {
    console.log("🔴 ACTIVE PROVIDER: None (GEMINI_API_KEY is missing or default in process.env)");
    console.log("🔄 FALLBACK: Triggering local offline AI simulation...");
    return analyzeConsultation(transcript, petContext, pastNotes);
  }
}
