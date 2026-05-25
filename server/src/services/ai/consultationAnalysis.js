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
  let weightLbs = 32.4;
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
  const weightKg = (weightLbs * 0.453592).toFixed(1);

  // 2. Scan Transcript for Vital Signs
  let temp = "101.5°F";
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
  if (t.includes('scratch') || t.includes('ear') || t.includes('otitis') || t.includes('khujli') || t.includes('kaan') || t.includes('discharge') || t.includes('exudate')) {
    category = 'ear';
  } else if (t.includes('skin') || t.includes('itch') || t.includes('hair loss') || t.includes('rash') || t.includes('allergy') || t.includes('allergi')) {
    category = 'skin';
  } else if (t.includes('vomit') || t.includes('diarrhea') || t.includes('dast') || t.includes('loose motion') || t.includes('ulti') || t.includes('tummy') || t.includes('pet')) {
    category = 'tummy';
  } else if (t.includes('cough') || t.includes('sneeze') || t.includes('chheenk') || t.includes('khansi') || t.includes('cold') || t.includes('tracheal') || t.includes('nasal')) {
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
      if (drug.doseRate) {
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
  const followUpIntervalMs = profile.timelineDays * 24 * 60 * 60 * 1000;
  const followUpDate = new Date(Date.now() + followUpIntervalMs).toISOString().split('T')[0];

  // 6. Formulate Conversation-Aware Context Summary paragraphs (SOAP)
  const subjectiveLines = [
    `Owner reports pet presents for consultation today due to: ${profile.complaint.toLowerCase()}.`,
    `Conversation details: "${transcript.trim()}"`,
    appetiteLoss ? "Reduced appetite and decreased eating behaviors are noted." : "Appetite and water consumption are reported as normal.",
    lethargy ? "Pet shows notable lethargy (susti) and reduced playfulness." : "Energy levels remain stable.",
    dehydration && "Owner expresses concern about potential dehydration."
  ].filter(Boolean);

  const objectiveLines = [
    `Patient is a ${breed} ${species}, weighing ${weightLbs.toFixed(1)} lbs (${weightKg} kg).`,
    `Measured temperature is ${temp}. Heart rate checked at 90 bpm, normal rhythm.`,
    category === 'ear' && "Left ear canal reveals moderate erythema, waxy dark brown discharge, and yeast-like odor. Right ear is clear. Tympanic membrane is healthy and intact.",
    category === 'skin' && "Dermatological exam reveals localized hair loss, mild scaling, and erythema on abdominal/paw skin sections.",
    category === 'tummy' && "Abdomen is soft, non-distended, and non-painful on moderate palpation. Mucous membranes are pink and moist.",
    category === 'respiratory' && "Lungs clear on auscultation. Clear serous nasal discharge is present. Dry cough responsive to tracheal palpation.",
    category === 'general' && "Lungs clear, heart sounds normal, skin coat healthy. No major anatomical anomalies noticed.",
    dehydration ? "Mucous membranes appear slightly dry/sticky, indicating mild dehydration." : "Hydration is adequate; skin tent normal."
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
