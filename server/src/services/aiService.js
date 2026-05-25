import { generateSOAPNote } from './ai/soapGeneration.js';

/**
 * Veterinary AI Service Router
 * Delegates consultation transcript processing to the unified modular AI service layer.
 */
export async function generateConsultationData(transcript, petContext = null, pastNotes = []) {
  return generateSOAPNote(transcript, petContext, pastNotes);
}
