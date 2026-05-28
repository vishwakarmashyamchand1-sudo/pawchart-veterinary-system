import express from 'express';
import mongoose from 'mongoose';
import AudioRecording from '../models/AudioRecording.js';
import AIConsultation from '../models/AIConsultation.js';
import { generateConsultationData } from '../services/aiService.js';
import { Appointment, Client, SoapNote } from '../models.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * standalone Anthropic Claude API test route
 */
router.get('/test-anthropic', async (req, res) => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  console.log("\n=================== 🧪 STANDALONE ANTHROPIC TEST STARTED ===================");
  if (anthropicKey) {
    const maskedKey = anthropicKey.length > 10 
      ? `${anthropicKey.slice(0, 6)}...${anthropicKey.slice(-4)}` 
      : "configured (short key)";
    console.log(`🔑 ANTHROPIC_API_KEY: FOUND (Length: ${anthropicKey.length}, Masked: ${maskedKey})`);
  } else {
    console.log("🔑 ANTHROPIC_API_KEY: ❌ NOT FOUND in process.env!");
    return res.status(500).json({
      success: false,
      message: "ANTHROPIC_API_KEY is missing from process.env!"
    });
  }

  try {
    console.log("🤖 Initializing basic prompt test with Anthropic Claude (claude-3-5-sonnet-20241022)...");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        temperature: 0.0,
        messages: [{ role: "user", content: "Hello from PawChart, are you active?" }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Anthropic API error");
    }

    const text = data.content?.[0]?.text || "";
    
    console.log("📥 Received standalone Anthropic response:", text);
    console.log("=================== 🧪 STANDALONE ANTHROPIC TEST SUCCESS ===================\n");
    
    return res.json({
      success: true,
      message: "Anthropic API is active and reachable!",
      modelUsed: "claude-3-5-sonnet-20241022",
      response: text
    });
  } catch (err) {
    console.error("❌ Standalone Anthropic Test failed:");
    console.error("Error Message:", err.message);
    console.log("=================== 🧪 STANDALONE ANTHROPIC TEST FAILED ===================\n");
    
    return res.status(500).json({
      success: false,
      message: `Anthropic standalone test failed: ${err.message}`,
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
    let vetName = 'Assigned Veterinarian';

    if (appointment_id && mongoose.Types.ObjectId.isValid(appointment_id)) {
      try {
        appointment = await Appointment.findById(appointment_id);
        if (appointment) {
          petName = appointment.petName;
          ownerName = appointment.ownerName;
          vetName = appointment.vetName || vetName;
          
          // Initialize petContext with appointment data first!
          petContext = {
            petName: appointment.petName,
            species: appointment.species || 'Unknown',
            breed: appointment.breed || 'Unknown',
            reason: appointment.reason || 'General Checkup'
          };

          // Look up client details to enrich pet species/breed/age/weight
          const client = await Client.findOne({ name: appointment.ownerName, "pets.name": appointment.petName });
          if (client) {
            const pet = client.pets.find(p => p.name === appointment.petName);
            if (pet) {
              petContext.age = pet.age;
              petContext.sex = pet.sex;
              petContext.weightRange = pet.weightRange;
              petContext.alerts = pet.alerts;
              if (pet.species) petContext.species = pet.species;
              if (pet.breed) petContext.breed = pet.breed;
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
      console.log(`\n📥 RAW DYNAMIC SOAP DATA GENERATED BY ANTHROPIC CLAUDE:`);
      console.log(JSON.stringify(aiData, null, 2));
    } catch (aiErr) {
      console.error("\n❌ CRITICAL: AI Service failed inside backend route:", aiErr);
      console.log("=========================================================================\n");
      // Stop silencing errors. Send full details to frontend.
      return res.status(500).json({
        success: false,
        message: `Anthropic API Error: ${aiErr.message}`,
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
      plan: aiData.plan || `Prescription: ${aiData.prescription.map(p => `${p.medicine_name} ${p.dosage} ${p.frequency}`).join(', ') || 'None'}. Follow-up: ${aiData.followUpDate || 'None'}.`,
      prescription: aiData.prescription || [],
      follow_up_date: aiData.followUpDate || ''
    };

    console.log(`\n📤 SOAP OBJECT PERSISTED & SENT TO FRONTEND PREVIEW:`);
    console.log(JSON.stringify(finalPreview, null, 2));
    console.log("=================== 📡 BACKEND AI PIPELINE COMPLETE ===================\n");

    res.status(201).json({
      success: true,
      consultation: aiConsultation,
      preview: finalPreview,
      rawGeminiOutput: aiData.rawJson || null,
      rawAnthropicOutput: aiData.rawJson || null
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
      vetName: vetName || 'Assigned Veterinarian',
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
