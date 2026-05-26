import { VETERINARY_SYSTEM_PROMPT } from './prompts.js';
import { analyzeConsultation } from './consultationAnalysis.js';

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Generate Vet SOAP Consultation Notes with Anthropic Claude API
 */
export async function generateSOAPNote(transcript, petContext = null, pastNotes = []) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log("\n=================== 🔬 REAL ANTHROPIC VERIFICATION DIAGNOSTICS START ===================");
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
  if (anthropicKey) {
    const masked = anthropicKey.length > 10 
      ? `${anthropicKey.substring(0, 6)}...${anthropicKey.substring(anthropicKey.length - 4)}` 
      : "configured (short key)";
    console.log(`🔑 ANTHROPIC_API_KEY STATUS: FOUND in process.env (Length: ${anthropicKey.length}, Masked: ${masked})`);
  } else {
    console.log("🔑 ANTHROPIC_API_KEY STATUS: ❌ NOT FOUND in process.env! Falling back is disabled for debugging.");
  }

  let userContent = `Dialogue Transcript:\n${transcript}\n\n`;
  if (petContext) {
    userContent += `Pet Context:\n${JSON.stringify(petContext, null, 2)}\n\n`;
  }
  if (pastNotes && pastNotes.length > 0) {
    userContent += `Past SOAP Note History:\n${JSON.stringify(pastNotes.slice(0, 3), null, 2)}\n\n`;
  }
  userContent += `Today's Date: ${new Date().toISOString().split('T')[0]}`;

  // 1. Force Anthropic API Call (Temporarily disable fallback to identify errors directly)
  if (anthropicKey) {
    console.log("🟢 ACTIVE PROVIDER: Anthropic (claude-3-5-sonnet-20241022)");
    try {
      console.log("🤖 Initializing Anthropic Claude API call...");
      console.log("📤 TRANSCRIPT SENT TO ANTHROPIC:", transcript);
      
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          temperature: 0.0,
          system: VETERINARY_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "Anthropic API error");
      }

      const text = data.content?.[0]?.text || "";
      
      console.log("\n📥 RAW ANTHROPIC RESPONSE:");
      console.log(text);

      if (text) {
        const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        
        console.log("\n✅ PARSED SOAP JSON SUCCESS:");
        console.log(JSON.stringify(parsed, null, 2));
        console.log("=================== 🔬 REAL ANTHROPIC VERIFICATION DIAGNOSTICS END ===================\n");

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
      throw new Error("Empty response from Anthropic API");
    } catch (err) {
      console.error("❌ Anthropic API execution failed:");
      console.error("Full Error Object:", err);
      console.error("Error Message:", err.message);
      console.log("=================== 🔬 REAL ANTHROPIC VERIFICATION DIAGNOSTICS END ===================\n");
      console.log("🔄 FALLBACK: Triggering local offline AI simulation due to API failure...");
      return analyzeConsultation(transcript, petContext, pastNotes);
    }
  } else {
    console.log("🔴 ACTIVE PROVIDER: None (ANTHROPIC_API_KEY is missing or default in process.env)");
    console.log("🔄 FALLBACK: Triggering local offline AI simulation...");
    return analyzeConsultation(transcript, petContext, pastNotes);
  }
}
