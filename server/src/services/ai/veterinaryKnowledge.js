/**
 * High-Fidelity Veterinary Clinical Knowledge Database
 */

export const VETERINARY_DRUG_DATABASE = {
  carprofen: {
    name: "Carprofen (Rimadyl)",
    doseRate: 4.4, // mg/kg per day
    frequency: "Once daily",
    instructions: "Administer with food to reduce GI side effects",
    duration: "7 days"
  },
  amoxicillin: {
    name: "Amoxicillin",
    doseRate: 11.0, // mg/kg twice daily
    frequency: "Twice daily",
    instructions: "Give with meals. Finish complete course.",
    duration: "10 days"
  },
  metronidazole: {
    name: "Metronidazole",
    doseRate: 10.0, // mg/kg twice daily
    frequency: "Twice daily",
    instructions: "Give with a bland meal (boiled chicken & rice)",
    duration: "5 days"
  },
  gabapentin: {
    name: "Gabapentin",
    doseRate: 5.0, // mg/kg
    frequency: "Twice daily",
    instructions: "Administer with or without food. May cause mild sedation.",
    duration: "14 days"
  },
  apoquel: {
    name: "Apoquel (Oclacitinib)",
    doseRate: 0.4, // mg/kg twice daily
    frequency: "Twice daily",
    instructions: "Give with or without food to control allergic pruritus",
    duration: "14 days"
  },
  cerenia: {
    name: "Cerenia (Maropitant)",
    doseRate: 2.0, // mg/kg once daily
    frequency: "Once daily",
    instructions: "Give 1 hour before meal. Highly effective anti-emetic.",
    duration: "3 days"
  },
  otomax: {
    name: "Otomax Ear Drops",
    dosage: "4 drops left ear",
    frequency: "Twice daily",
    instructions: "Apply into the ear canal after cleaning debris",
    duration: "7 days"
  }
};

export const SYMPTOM_DIAGNOSIS_MAP = {
  ear: {
    complaint: "Ear Scratching & Shaking Head",
    diagnosis: "Otitis Externa (Bacterial/Yeast Ear Infection)",
    meds: ["otomax", "gabapentin"],
    timelineDays: 14,
    diet: "Standard diet. Avoid getting water in the ears."
  },
  skin: {
    complaint: "Pruritus & Skin Allergy",
    diagnosis: "Atopic Dermatitis / Allergic Flare-up",
    meds: ["apoquel", "gabapentin"],
    timelineDays: 14,
    diet: "Hypoallergenic or single-protein source diet recommended."
  },
  tummy: {
    complaint: "Acute Vomiting & Diarrhea",
    diagnosis: "Acute Gastroenteritis (Dietary Indiscretion)",
    meds: ["metronidazole", "cerenia"],
    timelineDays: 7,
    diet: "Strict fast for 12 hours. Follow with a bland diet of boiled skinless chicken breast and white rice for 3 days."
  },
  respiratory: {
    complaint: "Sneezing & Nasal Discharge",
    diagnosis: "Infectious Canine Tracheobronchitis (Kennel Cough) / Feline URI",
    meds: ["amoxicillin"],
    timelineDays: 10,
    diet: "Warm, highly palatable soft wet food. Encourage hydration."
  }
};

export function getSpeciesVaxReminder(species, history = []) {
  const isDog = species?.toLowerCase() === 'dog';
  const hasRabies = history.some(h => h.toLowerCase().includes('rabies'));
  
  if (isDog) {
    return hasRabies ? "DHPP vaccine booster due" : "Rabies annual booster due";
  } else {
    return "FVRCP vaccine booster due";
  }
}
