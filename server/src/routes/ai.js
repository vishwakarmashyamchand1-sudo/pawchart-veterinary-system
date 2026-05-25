import express from 'express';
import mongoose from 'mongoose';
import AudioRecording from '../models/AudioRecording.js';
import AIConsultation from '../models/AIConsultation.js';
import { generateConsultationData } from '../services/aiService.js';
import { Appointment, Client, SoapNote } from '../models.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * standalone Gemini SDK test route
 */
router.get('/test-gemini', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log("\n=================== 🧪 STANDALONE GEMINI TEST STARTED ===================");
  if (geminiKey) {
    const maskedKey = geminiKey.length > 10 
      ? `${geminiKey.slice(0, 6)}...${geminiKey.slice(-4)}` 
      : "configured (short key)";
    console.log(`🔑 GEMINI_API_KEY: FOUND (Length: ${geminiKey.length}, Masked: ${maskedKey}, Start: ${geminiKey.slice(0, 10)}...)`);
  } else {
    console.log("🔑 GEMINI_API_KEY: ❌ NOT FOUND in process.env!");
    return res.status(500).json({
      success: false,
      message: "GEMINI_API_KEY is missing from process.env!"
    });
  }

  // Diagnostics 1: List all permitted models via direct REST call
  let permittedModels = [];
  let listError = null;
  try {
    console.log("🔍 Fetching available models directly from Google Generative Language API...");
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`);
    const listData = await listRes.json();
    if (listData.models) {
      permittedModels = listData.models.map(m => m.name);
      console.log("📋 PERMITTED MODELS DETECTED FOR THIS API KEY:", permittedModels);
    } else {
      console.warn("⚠️ API Key did not return any models list:", listData);
      listError = listData;
    }
  } catch (err) {
    console.error("⚠️ Failed to call models list REST endpoint:", err.message);
    listError = err.message;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);
    
    // We will dynamically test whatever models list is returned or default to gemini-1.5-flash
    const targetModel = permittedModels.length > 0 && permittedModels.some(m => m.includes('gemini-1.5-flash'))
      ? "gemini-1.5-flash"
      : permittedModels.length > 0
        ? permittedModels[0].replace('models/', '') // Use the first available model
        : "gemini-1.5-flash"; // Fallback to flash

    console.log(`🤖 Initializing model: ${targetModel}`);
    const model = genAI.getGenerativeModel({ model: targetModel });
    
    console.log(`📤 Sending basic prompt to ${targetModel}: 'Hello from PawChart, are you active?'`);
    const result = await model.generateContent("Hello from PawChart, are you active?");
    const response = await result.response;
    const text = response.text();
    
    console.log("📥 Received standalone response:", text);
    console.log("=================== 🧪 STANDALONE GEMINI TEST SUCCESS ===================\n");
    
    return res.json({
      success: true,
      message: "Gemini API is active and reachable!",
      modelUsed: targetModel,
      response: text,
      permittedModels
    });
  } catch (err) {
    console.error("❌ Standalone Gemini Test failed:");
    console.error("Full Error Object:", err);
    console.error("Error Message:", err.message);
    if (err.response) {
      console.error("Error Response Data:", err.response.data);
    }
    console.log("=================== 🧪 STANDALONE GEMINI TEST FAILED ===================\n");
    
    return res.status(500).json({
      success: false,
      message: `Gemini standalone test failed: ${err.message}`,
      permittedModels,
      listError,
      error: err.stack || err.message,
      fullError: err
    });
  }
});

/**
 * @openapi
 * /api/ai/process-transcript:
 *   post:
 *     summary: Process raw text/audio transcript using veterinary Claude AI
 *     tags: [AI Consultation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transcript
 *             properties:
 *               appointment_id:
 *                 type: string
 *               transcript:
 *                 type: string
 *               duration_seconds:
 *                 type: number
 *     responses:
 *       201:
 *         description: AudioRecording created and AIConsultation draft generated successfully
 */
router.post('/process-transcript', optionalAuth, async (req, res, next) => {
  try {
    const { appointment_id, transcript, duration_seconds } = req.body;
    if (!transcript) {
      return res.status(400).json({ message: 'Transcript content is required' });
    }

    const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);

    // Fetch appointment & build petContext
    let appointment = null;
    let petContext = null;
    let petName = 'Buddy';
    let ownerName = 'James Martinez';
    let vetName = 'Dr. Sarah Chen';

    if (appointment_id && mongoose.Types.ObjectId.isValid(appointment_id)) {
      try {
        appointment = await Appointment.findById(appointment_id);
        if (appointment) {
          petName = appointment.petName;
          ownerName = appointment.ownerName;
          vetName = appointment.vetName || vetName;
          
          // Look up client details for pet species/breed
          const client = await Client.findOne({ name: appointment.ownerName, "pets.name": appointment.petName });
          if (client) {
            const pet = client.pets.find(p => p.name === appointment.petName);
            if (pet) {
              petContext = {
                species: pet.species,
                breed: pet.breed,
                age: pet.age,
                sex: pet.sex,
                weightRange: pet.weightRange,
                alerts: pet.alerts
              };
            }
          }
        }
      } catch (err) {
        console.warn("Could not load appointment or client details, using defaults:", err.message);
      }
    }

    // Fetch previous SOAP notes for clinical history context
    let pastNotes = [];
    if (appointment?.petName) {
      try {
        pastNotes = await SoapNote.find({ petName: appointment.petName }).sort({ createdAt: -1 }).limit(5);
      } catch (err) {
        console.warn("Could not load past SOAP notes for AI memory:", err.message);
      }
    }

    // Call the AI Service with try/catch safeguard and forced debug logging
    let aiData;
    console.log("\n=================== 📡 BACKEND AI PIPELINE INTERCEPTED ===================");
    console.log(`📥 API Route: /api/ai/process-transcript`);
    console.log(`📦 Payload received:`, JSON.stringify({ appointment_id, transcript, duration_seconds }, null, 2));
    
    try {
      aiData = await generateConsultationData(transcript, petContext, pastNotes);
      console.log(`\n📥 RAW DYNAMIC SOAP DATA GENERATED BY GEMINI:`);
      console.log(JSON.stringify(aiData, null, 2));
    } catch (aiErr) {
      console.error("\n❌ CRITICAL: AI Service failed inside backend route:", aiErr);
      console.log("=========================================================================\n");
      // Stop silencing errors. Send full details to frontend.
      return res.status(500).json({
        success: false,
        message: `Gemini API/SDK Error: ${aiErr.message}`,
        error: aiErr.stack || aiErr.message
      });
    }

    // Save AudioRecording
    const recording = await AudioRecording.create({
      appointment_id: appointment_id && mongoose.Types.ObjectId.isValid(appointment_id) ? appointment_id : new mongoose.Types.ObjectId(),
      clinic_id: clinicId || appointment?.clinic_id,
      transcript,
      duration_seconds: duration_seconds || 0,
      status: 'processed'
    });

    // Save AIConsultation
    const aiConsultation = await AIConsultation.create({
      appointment_id: appointment_id && mongoose.Types.ObjectId.isValid(appointment_id) ? appointment_id : new mongoose.Types.ObjectId(),
      recording_id: recording._id,
      clinic_id: clinicId || appointment?.clinic_id,
      raw_transcript: transcript,
      summary: aiData.summary,
      chief_complaint: aiData.chiefComplaint,
      diagnosis: aiData.diagnosis,
      prescription_data: aiData.prescription.map(p => ({
        medicine_name: p.medicine_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions
      })),
      follow_up_date: aiData.followUpDate ? new Date(aiData.followUpDate) : null,
      status: 'draft'
    });

    const finalPreview = {
      subjective: aiData.subjective || `Chief Complaint: ${aiData.chiefComplaint}. Owner reports symptoms: ${transcript}`,
      objective: aiData.objective || `General observations. Weight stable. Vitals normal.`,
      assessment: aiData.assessment || `Primary diagnosis: ${aiData.diagnosis}.`,
      plan: aiData.plan || `Prescription: ${aiData.prescription.map(p => `${p.medicine_name} ${p.dosage} ${p.frequency}`).join(', ') || 'None'}. Follow-up: ${aiData.followUpDate || 'None'}.`
    };

    console.log(`\n📤 SOAP OBJECT PERSISTED & SENT TO FRONTEND PREVIEW:`);
    console.log(JSON.stringify(finalPreview, null, 2));
    console.log("=================== 📡 BACKEND AI PIPELINE COMPLETE ===================\n");

    res.status(201).json({
      success: true,
      consultation: aiConsultation,
      preview: finalPreview,
      rawGeminiOutput: aiData.rawJson || null
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/ai/by-appointment/{appointmentId}:
 *   get:
 *     summary: Retrieve active draft consultation by Appointment ID
 *     tags: [AI Consultation]
 *     parameters:
 *       - name: appointmentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active draft or null retrieved successfully
 */
router.get('/by-appointment/:appointmentId', optionalAuth, async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const filter = { appointment_id: appointmentId, status: 'draft' };
    
    const draft = await AIConsultation.findOne(filter).sort({ createdAt: -1 }).lean();
    res.json(draft || null);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/ai/{id}/review:
 *   put:
 *     summary: Update intermediate doctor edits for an AI consultation draft
 *     tags: [AI Consultation]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Draft reviewed and updated successfully
 */
router.put('/:id/review', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await AIConsultation.findByIdAndUpdate(
      id,
      {
        status: 'reviewed',
        doctor_edits: req.body
      },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'AIConsultation draft not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/ai/{id}/save:
 *   post:
 *     summary: Create final SoapNote from reviewed draft and mark appointment completed
 *     tags: [AI Consultation]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - petName
 *               - ownerName
 *               - vetName
 *               - subjective
 *               - objective
 *               - assessment
 *               - plan
 *             properties:
 *               petName:
 *                 type: string
 *               ownerName:
 *                 type: string
 *               vetName:
 *                 type: string
 *               subjective:
 *                 type: string
 *               objective:
 *                 type: string
 *               assessment:
 *                 type: string
 *               plan:
 *                 type: string
 *     responses:
 *       201:
 *         description: SoapNote saved successfully and consultation marked saved
 */
router.post('/:id/save', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { petName, ownerName, vetName, subjective, objective, assessment, plan, tags } = req.body;

    const aiConsultation = await AIConsultation.findById(id);
    if (!aiConsultation) {
      return res.status(404).json({ message: 'AIConsultation not found' });
    }

    // Save final SOAP Note
    const soapNote = await SoapNote.create({
      petName: petName || 'Buddy',
      ownerName: ownerName || 'James Martinez',
      vetName: vetName || 'Dr. Sarah Chen',
      subjective,
      objective,
      assessment,
      plan,
      tags: tags || [],
      clinic_id: aiConsultation.clinic_id
    });

    // Update draft to 'saved'
    aiConsultation.status = 'saved';
    aiConsultation.saved_at = new Date();
    await aiConsultation.save();

    // Mark appointment as 'Completed'
    if (aiConsultation.appointment_id) {
      await Appointment.findByIdAndUpdate(aiConsultation.appointment_id, { status: 'Completed' });
    }

    res.status(201).json({
      success: true,
      soapNote,
      consultation: aiConsultation
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/ai/{id}:
 *   delete:
 *     summary: Discard an AI consultation draft
 *     tags: [AI Consultation]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Consultation draft discarded successfully
 */
router.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await AIConsultation.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'AIConsultation draft not found' });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
