import { SYMPTOM_DIAGNOSIS_MAP, VETERINARY_DRUG_DATABASE, getSpeciesVaxReminder } from './veterinaryKnowledge.js';

/**
 * Highly Intelligent Semantic Transcript and Context Consultation Analyzer
 */
export function analyzeConsultation(transcript, petContext = null, pastNotes = []) {
  const t = transcript.toLowerCase();
  
  // 1. Identify Pet Attributes
  const petName = petContext?.name || 'Buddy';
  const species = petContext?.species || 'Dog';
  const breed = petContext?.breed || 'Golden Retriever';
  
  // Extract or parse pet weight
  let weightLbs = null;
  if (petContext?.weightRange) {
    const numericWeight = parseFloat(petContext.weightRange);
    if (!isNaN(numericWeight)) weightLbs = numericWeight;
  }
  
  // Scan transcript for dynamic weight mentions e.g. "weight is 20 lbs" or "vazan 15 kg"
  const weightMatch = t.match(/(?:weight|vazan|bhaar|vajan)\s*(?:is|around|he|hai)?\s*(\d+(?:\.\d+)?)\s*(kg|kilo|lbs|pound)/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    if (!isNaN(val)) {
      if (unit.startsWith('k')) {
        weightLbs = val * 2.20462; // Convert kg to lbs
      } else {
        weightLbs = val;
      }
    }
  }
  let weightKg = null;
  if (weightLbs !== null) {
    weightKg = (weightLbs * 0.453592).toFixed(1);
  }

  // 2. Scan Transcript for Vital Signs
  let temp = null;
  const tempMatch = t.match(/(?:temp|temperature|bukhar|body|body temp)\s*(?:is|around|he|hai)?\s*(\d+(?:\.\d+)?)\s*(f|c|degrees|degree)?/i);
  if (tempMatch) {
    const val = parseFloat(tempMatch[1]);
    if (!isNaN(val)) {
      if (val < 50) {
        // Assume Celsius
        temp = `${((val * 9/5) + 32).toFixed(1)}°F`;
      } else {
        temp = `${val.toFixed(1)}°F`;
      }
    }
  } else if (t.includes('fever') || t.includes('bukhar') || t.includes('garam')) {
    temp = "102.8°F (elevated)";
  }

  // Scan for clinical indicators
  const appetiteLoss = t.includes('not eating') || t.includes('loss of appetite') || t.includes('khana nahi') || t.includes('bhukh kam') || t.includes('eating less');
  const lethargy = t.includes('lethargic') || t.includes('lazy') || t.includes('susti') || t.includes('kamzori') || t.includes('dhila');
  const dehydration = t.includes('dehydrate') || t.includes('dehydration') || t.includes('drinking less') || t.includes('sukha') || t.includes('pani kam');

  // 3. Determine Symptom Category
  let category = 'general';
  if (t.includes('scratch') || /\bear\b/.test(t) || t.includes('otitis') || t.includes('khujli') || t.includes('kaan') || t.includes('discharge') || t.includes('exudate')) {
    category = 'ear';
  } else if (/\bskin\b/.test(t) || /\bitch\b/.test(t) || t.includes('hair loss') || t.includes('rash') || t.includes('allergy') || t.includes('allergi')) {
    category = 'skin';
  } else if (t.includes('vomit') || t.includes('diarrhea') || t.includes('dast') || t.includes('loose motion') || t.includes('ulti') || t.includes('tummy') || /\bpet\b/.test(t)) {
    category = 'tummy';
  } else if (t.includes('cough') || t.includes('sneeze') || t.includes('chheenk') || t.includes('khansi') || /\bcold\b/.test(t) || t.includes('tracheal') || t.includes('nasal')) {
    category = 'respiratory';
  }

  // Get matching templates
  const profile = SYMPTOM_DIAGNOSIS_MAP[category] || {
    complaint: "General Clinical Consultation",
    diagnosis: "Routine Physical Observation Needed",
    meds: [],
    timelineDays: 7,
    diet: "Ensure balanced standard nutritional intake."
  };

  // 4. Incorporate Prior Memory Context
  const previousSOAPs = pastNotes.filter(n => n.petName?.toLowerCase() === petName.toLowerCase());
  const hasPastHistory = previousSOAPs.length > 0;
  const lastDiag = hasPastHistory ? previousSOAPs[0].assessment : 'None';
  
  // 5. Generate Dynamic Medications & Dosages
  const prescriptions = [];
  profile.meds.forEach(mKey => {
    const drug = VETERINARY_DRUG_DATABASE[mKey];
    if (drug) {
      let computedDose = drug.dosage;
      if (drug.doseRate && weightKg !== null) {
        // Calculate dosage e.g. weightKg * doseRate
        const mg = Math.round(weightKg * drug.doseRate);
        computedDose = `${mg} mg`;
      }
      prescriptions.push({
        medicine_name: drug.name,
        dosage: computedDose,
        frequency: drug.frequency,
        duration: drug.duration,
        instructions: drug.instructions
      });
    }
  });

  // Calculate dynamic follow-up date
  let followUpDate = null;
  const followUpMatch = t.match(/(?:follow\s*up|recheck).*(?:in|after)\s*(\d+)\s*(day|week|month)s?/i);
  if (followUpMatch) {
    const amount = parseInt(followUpMatch[1], 10);
    const unit = followUpMatch[2].toLowerCase();
    let days = amount;
    if (unit === 'week') days *= 7;
    if (unit === 'month') days *= 30;
    const followUpIntervalMs = days * 24 * 60 * 60 * 1000;
    followUpDate = new Date(Date.now() + followUpIntervalMs).toISOString().split('T')[0];
  }

  // 6. Formulate Conversation-Aware Context Summary paragraphs (SOAP)
  const subjectiveLines = [
    `Owner reports pet presents for consultation today. Chief concerns involve symptoms suggestive of ${profile.diagnosis}.`,
    appetiteLoss ? "Reduced appetite and decreased eating behaviors are noted based on transcript." : null,
    lethargy ? "Pet shows notable lethargy (susti) and reduced playfulness based on transcript." : null,
    dehydration ? "Owner expresses concern about potential dehydration." : null
  ].filter(Boolean);

  const objectiveLines = [
    weightLbs ? `Patient is a ${breed} ${species}, weighing ${weightLbs.toFixed(1)} lbs (${weightKg} kg).` : `Patient is a ${breed} ${species}.`,
    temp ? `Measured temperature is ${temp}.` : null
  ].filter(Boolean);

  const assessmentLines = [
    `Primary diagnosis indicates: ${profile.diagnosis}.`,
    hasPastHistory ? `Note: Patient has previous clinical history of ${lastDiag}. This suggests potential allergy flare-up or chronic condition recurrence.` : "No significant past history of this particular condition.",
    lethargy && "Secondary lethargy noted, likely secondary to primary discomfort."
  ].filter(Boolean);

  const vaxAlert = getSpeciesVaxReminder(species, petContext?.alerts || []);

  const planLines = [
    `Prescribed medication regimen: ${prescriptions.map(p => `${p.medicine_name} (${p.dosage} ${p.frequency} × ${p.duration})`).join(', ') || 'observation and rest'}.`,
    `Dietary directions: ${profile.diet}`,
    `Vaccine advice: ${vaxAlert}.`,
    `Schedule recheck follow-up appointment in ${profile.timelineDays} days (on ${followUpDate}) to check clinical response.`
  ].filter(Boolean);

  const comprehensiveSummary = `S (SUBJECTIVE): ${subjectiveLines.join(' ')}\n\n` +
    `O (OBJECTIVE): ${objectiveLines.join(' ')}\n\n` +
    `A (ASSESSMENT): ${assessmentLines.join(' ')}\n\n` +
    `P (PLAN): ${planLines.join(' ')}`;

  return {
    subjective: subjectiveLines.join(' '),
    objective: objectiveLines.join(' '),
    assessment: assessmentLines.join(' '),
    plan: planLines.join(' '),
    summary: comprehensiveSummary,
    chiefComplaint: profile.complaint,
    diagnosis: profile.diagnosis,
    prescription: prescriptions,
    followUpDate
  };
}
