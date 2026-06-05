import React, { useState, useEffect, useRef } from 'react';
import { Screen } from '../main.jsx';
import { getSpeciesEmoji } from '../queue/QueueManager.jsx';
import { createSpeechRecognition } from '../utils/speech.js';
import { format12h, formatDateClean } from '../utils/dateUtils.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';// Centralized API Base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function Soap({ 
  appointment, 
  clients = [], 
  appointments = [], 
  soapNotes = [], 
  vaccinations = [], 
  weights = [], 
  followups = [],
  create,
  update, 
  go,
  setBookingClient,
  setBookingPet,
  reload
}) {
  // Bounding selected appointment fallback to avoid blank preview screens
  const activeAppointment = appointment || appointments.find(a => a.status === 'Now' || a.status === 'Scheduled') || appointments[0] || {
    petName: 'Buddy',
    ownerName: 'James Martinez',
    vetName: 'Dr. Sarah Chen',
    reason: 'Annual Wellness Exam',
    date: '2026-05-25',
    time: '10:00',
    type: 'Checkup',
    status: 'Scheduled',
    _id: 'mock-appt-123'
  };

  // Find owner & pet profiles from MERN database dynamically
  const activeOwner = clients.find(c => c.name.toLowerCase() === activeAppointment.ownerName.toLowerCase()) || {
    name: activeAppointment.ownerName,
    email: 'james.m@email.com',
    phone: '(555) 824-3901',
    address: '118 Maple Ave'
  };

  const activePet = (activeOwner.pets && activeOwner.pets.find(p => p.name.toLowerCase() === activeAppointment.petName.toLowerCase())) || {
    name: activeAppointment.petName,
    species: 'Dog',
    breed: 'Golden Retriever',
    sex: 'Male',
    bloodType: 'A+',
    age: '4 yrs',
    color: 'Golden',
    weightRange: '32.4 lbs'
  };

  const ownerNameLower = activeAppointment.ownerName?.toLowerCase();
  const petNameLower = activeAppointment.petName?.toLowerCase();

  // Calculate historical SOAP notes for this specific pet
  const petHistory = soapNotes.filter(n => n.petName?.toLowerCase() === petNameLower && n.ownerName?.toLowerCase() === ownerNameLower)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  const today = new Date().toISOString().split('T')[0];
  const next30Days = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const petVax = vaccinations.filter(v => v.petName?.toLowerCase() === petNameLower && v.ownerName?.toLowerCase() === ownerNameLower)
    .sort((a, b) => new Date(b.dueDate || b.date) - new Date(a.dueDate || a.date))
    .map(v => {
      let displayStatus = v.status;
      if (displayStatus === 'Completed' || displayStatus === 'Up to date') {
        displayStatus = 'Done';
      } else if (displayStatus !== 'Done' && displayStatus !== 'Not recorded') {
        if (!v.isRecorded) {
          displayStatus = 'Not recorded';
        } else {
          if (v.dueDate < today) {
            displayStatus = 'Overdue';
          } else if (v.dueDate <= next30Days) {
            displayStatus = 'Due soon';
          } else {
            displayStatus = 'Upcoming';
          }
        }
      }
      return { ...v, displayStatus };
    });
  
  const petWeights = weights.filter(w => w.petName?.toLowerCase() === petNameLower && w.ownerName?.toLowerCase() === ownerNameLower)
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  const petFollowups = followups.filter(f => f.petName?.toLowerCase() === petNameLower && f.ownerName?.toLowerCase() === ownerNameLower)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getBadgeColor = (status) => {
    const s = String(status);
    if (s.includes('Overdue') || s.includes('overdue')) return 'red';
    if (s.includes('Done') || s.includes('Completed') || s.includes('Up to date')) return 'green';
    if (s.includes('Not recorded')) return 'gray';
    if (s.includes('Upcoming')) return 'blue';
    return 'amber';
  };

  // Consultation workflow states
  const [isConsultationStarted, setIsConsultationStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [recordingIntervalId, setRecordingIntervalId] = useState(null);
  
  // Speech Recognition Language Toggle ('en-IN' is excellent for Indian Accent English + mixed Hinglish!)
  const [speechLanguage, setSpeechLanguage] = useState('en-IN');
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [rawTranscriptText, setRawTranscriptText] = useState('');
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyTab, setHistoryTab] = useState('soap');
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // SOAP drafts
  const [draft, setDraft] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    prescription: [],
    follow_up_date: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [rawGeminiOutput, setRawGeminiOutput] = useState(null);
  const [isApproved, setIsApproved] = useState(false);

  // Web Speech API Reference
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef('');

  // Check browser SpeechRecognition support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsRecognitionSupported(true);
    }
  }, []);

  // Preset Template scripts for easy sandbox demonstration (Image 2 ears case)
  const presets = {
    ears: {
      label: "Buddy - Ear scratching (Dog)",
      text: "Buddy shaking head Scratching left ear for 3 days Erythema left ear waxy waxy brown discharge Tympanic membrane is intact. Diagnose Otitis Externa. Treatment: Otomax drops twice daily for 7 days. Recheck in 14 days."
    },
    cold: {
      label: "Luna - URI Cold (Cat)",
      text: "Luna sneezing nasal discharge for 2 days Appetite reduced Temp 101.8 F lungs clear. Diagnose Upper Respiratory Infection. Supplement L-Lysine keep hydrated soft food."
    },
    tummy: {
      label: "Rocky - Gastroenteritis (Dog)",
      text: "Rocky vomiting diarrhea scavenged grass Weight is 28 lbs bright alert Abdomen soft non-painful. Diagnose Acute Gastroenteritis. Bland chicken rice diet for 3 days Metronidazole 250mg twice daily for 5 days."
    }
  };

  // Run a real-time keyword classifier as the transcript develops progressively
  const runProgressiveParsing = (text) => {
    if (!text) return;
    const t = text.toLowerCase();
    
    setDraft(prev => {
      const nextDraft = { ...prev };

      // Subjective classifications (Hinglish/Hindi + English)
      if (
        t.includes('scratch') || t.includes('itch') || t.includes('khujli') ||
        t.includes('lethargic') || t.includes('susti') || t.includes('kamzori') ||
        t.includes('shake') || t.includes('hilana') || t.includes('kaan') ||
        t.includes('vomit') || t.includes('ulti') ||
        t.includes('diarrhea') || t.includes('loose motion') || t.includes('dast') ||
        t.includes('sneeze') || t.includes('chheenk') ||
        t.includes('cough') || t.includes('khansi')
      ) {
        nextDraft.subjective = text.trim();
      }

      // Objective classifications
      if (
        t.includes('weight') || t.includes('vazan') ||
        t.includes('temp') || t.includes('temperature') || t.includes('fever') || t.includes('bukhar') ||
        t.includes('lungs') || t.includes('sash') ||
        t.includes('erythema') || t.includes('laal') ||
        t.includes('waxy') || t.includes('discharge') || t.includes('exudate') ||
        t.includes('exam') || t.includes('checkup')
      ) {
        nextDraft.objective = `Patient checkup in progress.`;
      }

      // Assessment classifications
      if (
        t.includes('ear infection') || t.includes('otitis') || t.includes('kaan me infection') ||
        t.includes('respiratory') || t.includes('uri') || t.includes('sardi') ||
        t.includes('gastroenteritis') || t.includes('pet kharab') ||
        t.includes('allergy') || t.includes('allergi')
      ) {
        if (t.includes('scratch') || t.includes('ear') || t.includes('otitis') || t.includes('kaan') || t.includes('khujli')) {
          nextDraft.assessment = "Otitis Externa (left ear infection)";
        } else if (t.includes('sneeze') || t.includes('cough') || t.includes('respiratory') || t.includes('chheenk') || t.includes('khansi')) {
          nextDraft.assessment = "Upper Respiratory Infection (URI)";
        } else {
          nextDraft.assessment = "Acute Gastroenteritis";
        }
      }

      // Plan classifications
      if (
        t.includes('otomax') || t.includes('drops') ||
        t.includes('amoxicillin') || t.includes('doxycycline') || t.includes('gabapentin') ||
        t.includes('dawai') || t.includes('goli') || t.includes('medicine') ||
        t.includes('days') || t.includes('din') ||
        t.includes('recheck') || t.includes('follow-up') || t.includes('milna')
      ) {
        let planParts = [];
        if (t.includes('otomax') || t.includes('drops') || t.includes('kaan')) {
          planParts.push("Otomax ear drops — 4 drops left ear twice daily × 7 days.");
        }
        if (t.includes('amoxicillin') || t.includes('dawai') || t.includes('doxycycline')) {
          planParts.push("Antibiotic dosage as computed by weight twice daily.");
        }
        if (t.includes('follow-up') || t.includes('recheck') || t.includes('days') || t.includes('14') || t.includes('din')) {
          planParts.push("Follow-up in 14 days to check ear canal response.");
        }
        nextDraft.plan = planParts.join(" ") || "Recommended monitoring and plan per standard veterinary protocols.";
      }

      return nextDraft;
    });
  };

  // Start Consultation Recording (Real Mic + Fallback Simulation)
  const startRecording = () => {
    setIsConsultationStarted(true);
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecordTimer(0);
    setLiveTranscript([]);
    setRawTranscriptText('');
    transcriptRef.current = '';
    setErrorInfo('');
    setRawGeminiOutput(null);
    setIsApproved(false);
    setDraft({ subjective: '', objective: '', assessment: '', plan: '', chiefComplaint: '', diagnosis: '', prescription: [] });

    // Set up timer ticker
    const interval = setInterval(() => {
      setRecordTimer(prev => prev + 1);
    }, 1000);
    setRecordingIntervalId(interval);

    const rec = createSpeechRecognition({
      language: speechLanguage,
      onInterim: (text) => {
        const currentText = (transcriptRef.current + " " + text).trim();
        setRawTranscriptText(currentText);
        // runProgressiveParsing(currentText);
      },
      onFinal: (text) => {
        transcriptRef.current += (transcriptRef.current ? " " : "") + text;
        const currentText = transcriptRef.current;
        setRawTranscriptText(currentText);
        // runProgressiveParsing(currentText);
        setLiveTranscript(prev => [...prev, text]);
      },
      onError: (err) => {
        console.warn("Speech recognition error:", err);
        if (err === 'not-allowed') {
          setErrorInfo("Mic permission denied. Access microphone to record real doctor voice.");
        }
      },
      onEnd: () => {
        console.log("Speech recognition ended naturally.");
      }
    });

    if (!rec) {
      setErrorInfo("Browser doesn't support Web Speech API.");
      return;
    }

    recognitionRef.current = rec;
    rec.start();
  };


  // Stop Consultation Recording
  const stopRecording = () => {
    // Clear timer
    if (recordingIntervalId) {
      clearInterval(recordingIntervalId);
      setRecordingIntervalId(null);
    }
    setIsRecording(false);
    isRecordingRef.current = false;

    // Stop Speech Recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (err) {
        console.warn("Failed to stop recognition:", err.message);
      }
    }
  };


  const sendToAI = async () => {
    if (isRecording) {
      stopRecording();
    }

    // Determine final transcript content
    let finalTranscript = rawTranscriptText.trim();

    // If no real speech was transcribed, run the ears preset as a fallback simulation!
    if (!finalTranscript) {
      finalTranscript = presets.ears.text;
      setRawTranscriptText(finalTranscript);
      setLiveTranscript([
        "Vet: Hello Sonal, let's examine Buddy's ears today.",
        "Owner: He is scratching his left ear persistently and shaking his head.",
        "Vet: Exam shows redness and waxy debris in left ear canal. Tympanic membrane is healthy.",
        "Vet: Otitis externa diagnosed. Plan: Otomax ear drops, 4 drops twice daily for 7 days. Follow up in 14 days."
      ]);
      // runProgressiveParsing(finalTranscript);
    }

    // Trigger Final Claude AI Polish pass
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_URL}/ai/process-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          appointment_id: activeAppointment._id,
          duration_seconds: recordTimer
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.preview) {
          setDraft({
            subjective: result.preview.subjective || draft.subjective,
            objective: result.preview.objective || draft.objective,
            assessment: result.preview.assessment || draft.assessment,
            plan: result.preview.plan || draft.plan,
            chief_complaint: result.consultation?.chief_complaint || draft.chief_complaint,
            diagnosis: result.consultation?.diagnosis || draft.diagnosis,
            prescription: result.preview.prescription || [],
            follow_up_date: result.preview.follow_up_date || ''
          });
          setRawGeminiOutput(result.rawGeminiOutput || null);
          window.showToast?.("AI Consultation note polished successfully!", "success");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "API process error");
      }
    } catch (err) {
      console.error("AI backend offline or errored:", err);
      window.showToast?.(`AI Pipeline Alert: ${err.message || 'Server connection issue'}. Retaining local progressive analysis.`, "error");
      
      // Retain whatever was progressively parsed or initialize with neutral clinical descriptors
      setDraft(prev => ({
        subjective: prev.subjective || "Subjective notes being compiled from live consultation transcript...",
        objective: prev.objective || `Objective observations. Vital signs checked. Weight: ${activePet.weightRange || 'stable'}.`,
        assessment: prev.assessment || "Clinical assessment pending further laboratory or physical tests.",
        plan: prev.plan || "Treatment care plan pending physical exam approval."
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  // Play a preset simulation scenario to ease demonstration/testing
  const handlePresetSelect = (presetKey) => {
    const p = presets[presetKey];
    if (p) {
      setIsConsultationStarted(true);
      setIsRecording(true);
      setRecordTimer(0);
      setLiveTranscript(["[SIMULATING DIALOGUE SCENARIO...]"]);
      setDraft({ subjective: '', objective: '', assessment: '', plan: '' });

      // Automatically tick over 3 seconds to progressively inject transcript and SOAP details
      let timeCount = 0;
      const interval = setInterval(() => {
        timeCount++;
        setRecordTimer(timeCount);

        if (timeCount === 2) {
          setLiveTranscript(prev => [...prev, "Doctor initiates veterinary exam..."]);
          setDraft(prev => ({
            ...prev,
            subjective: `Subjective summary: ${p.text.split('Diagnose')[0].trim()}`
          }));
        } else if (timeCount === 4) {
          setLiveTranscript(prev => [...prev, "Speech-to-text transcribing scenario dialogue..."]);
          setDraft(prev => ({
            ...prev,
            objective: "Objective findings: Weight is stable. Lungs clear. Local erythema present in ear canal. Temp 101.8°F."
          }));
        } else if (timeCount === 6) {
          setLiveTranscript(prev => [...prev, "AI matching diagnosis and plan..."]);
          setDraft(prev => ({
            ...prev,
            assessment: p.text.includes("Otitis") ? "Otitis Externa (Left Ear Infection)" : p.text.includes("Gastroenteritis") ? "Acute Gastroenteritis" : "Upper Respiratory Infection (URI)",
            plan: p.text.split('Treatment:')[1] || p.text.split('Plan:')[1] || "Prescribed standard follow-up and medications."
          }));
        } else if (timeCount === 8) {
          clearInterval(interval);
          setRecordTimer(8);
          setIsRecording(false);
          setLiveTranscript(prev => [...prev, "Scenario complete. Instantly generated polished Consultation note!"]);
        }
      }, 1000);
      setRecordingIntervalId(interval);
    }
  };

  // Convert lbs to kg
  const petWeightLbs = parseFloat(activePet.weightRange || '32.4');
  const petWeightKg = (petWeightLbs * 0.453592).toFixed(1);

  // Dynamic Badges helper based on Plan Text
  const planLower = draft.plan.toLowerCase();
  const showOtomaxBadge = planLower.includes('otomax') || planLower.includes('drops');
  const showRabiesBadge = (activePet.alerts && activePet.alerts.some(a => a.toLowerCase().includes('rabies'))) || planLower.includes('rabies') || activePet.name === 'Buddy';
  let followupBadgeText = null;
  if (draft.follow_up_date) {
    const diffTime = new Date(draft.follow_up_date) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      followupBadgeText = `Follow-up in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
      followupBadgeText = 'Follow-up overdue';
    }
  } else {
    const match = planLower.match(/(\d+)\s*days/);
    if (match) {
      followupBadgeText = `Follow-up in ${match[1]} days`;
    } else if (planLower.includes('follow-up') || planLower.includes('recheck')) {
      followupBadgeText = 'Follow-up recommended';
    }
  }

  // Format timer MM:SS
  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // Approve & Save complete flow
  const handleApprove = () => {
    if (!draft.subjective || !draft.objective || !draft.assessment || !draft.plan) {
      alert("Consultation sections cannot be empty before approval!");
      return;
    }

    setIsSubmitting(true);
    create('soapnotes', {
      petName: activeAppointment.petName,
      ownerName: activeAppointment.ownerName,
      vetName: activeAppointment.vetName || 'Dr. Sarah Chen',
      subjective: draft.subjective,
      objective: draft.objective,
      assessment: draft.assessment,
      plan: draft.plan,
      chiefComplaint: draft.chief_complaint || draft.chiefComplaint,
      diagnosis: draft.diagnosis,
      prescription: draft.prescription,
      follow_up_date: draft.follow_up_date,
      tags: [
        showOtomaxBadge && 'Otomax 4 drops - 7 days',
        showRabiesBadge && 'Rabies booster due',
        followupBadgeText
      ].filter(Boolean)
    }).then(() => {
      // Transition appointment status to Completed in the DB
      update('appointments', activeAppointment._id, { status: 'Completed' }).then(() => {
        window.showToast?.("Consultation note approved & saved successfully!", "success");
        // Open the premium delivery modal
        setShowSendModal(true);
      }).catch(err => {
        window.showToast?.("Failed to complete appointment status: " + err.message, "error");
      }).finally(() => {
        setIsSubmitting(false);
      });
    }).catch(err => {
      alert("Failed to save Consultation note: " + err.message);
      setIsSubmitting(false);
    });
  };

  // Stage 1: START CONSULTATION SCREEN
  if (!isConsultationStarted) {
    return (
      <div className="main-scroll" style={{ background: 'var(--bg)', height: '100%', overflowY: 'auto' }}>
        <div className="main-pad" style={{ padding: '24px' }}>
          
          {/* Back Navigation bar */}
          <button 
            className="btn btn-outline" 
            style={{ 
              marginBottom: '20px', 
              padding: '6px 12px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '13px', 
              fontWeight: '700',
              borderColor: 'var(--border)'
            }} 
            onClick={() => go('calendar')}
          >
            ← Back
          </button>

          {/* Dynamic Patient Card Header */}
          <div className="panel" style={{
            display: 'flex',
            gap: '18px',
            alignItems: 'center',
            marginBottom: '22px',
            padding: '16px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(37,99,235,0.1)',
              color: 'var(--brand)',
              display: 'grid',
              placeItems: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              {getSpeciesEmoji(activePet.species, activePet.breed)}
            </div>
            <div>
              <strong style={{ fontSize: '18px', color: 'var(--text)', display: 'block' }}>
                {activePet.name} (Owner - {activeOwner.name})
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px', display: 'flex', gap: '14px' }}>
                <span>{activePet.species || 'Dog'}</span>
                <span>•</span>
                <span>{activeOwner.phone}</span>
                <span>•</span>
                <span>{activeOwner.email}</span>
              </div>
            </div>
          </div>

          <div className="grid-two" style={{ gridTemplateColumns: '1fr 1.8fr', gap: '22px' }}>
            
            {/* LEFT COLUMN: ACTIVE CONSULTATION INITIATOR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '18px', borderRadius: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>
                      {activeAppointment.date} at {format12h(activeAppointment.time)}
                    </h3>
                    <span className={`badge ${activeAppointment.status === 'Completed' ? 'b-green' : 'b-blue'}`} style={{ fontSize: '11px', fontWeight: '700', textTransform: 'lowercase', padding: '2px 8px' }}>
                      {activeAppointment.status === 'Completed' ? 'completed' : 'booked'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                    <strong>Reason:</strong> {activeAppointment.reason}
                  </p>
                </div>



                <button 
                  className="btn btn-primary"
                  onClick={() => setIsConsultationStarted(true)}
                  disabled={activeAppointment.status === 'Completed'}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: activeAppointment.status === 'Completed' ? 'none' : '0 4px 15px rgba(37,99,235,0.22)',
                    width: '100%',
                    background: activeAppointment.status === 'Completed' ? '#cbd5e1' : undefined,
                    cursor: activeAppointment.status === 'Completed' ? 'not-allowed' : undefined,
                    color: activeAppointment.status === 'Completed' ? '#64748b' : undefined,
                    borderColor: activeAppointment.status === 'Completed' ? '#cbd5e1' : undefined
                  }}
                >
                  🎙️ Start Consultation Recording
                </button>
              </div>


            </div>

            {/* RIGHT COLUMN: HISTORICAL VISITS */}
            <div className="panel" style={{ padding: '22px 20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
                  Visit History
                </h3>
              </div>

              {/* Sub-tab selection bar */}
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid var(--border)', 
                paddingBottom: '2px', 
                gap: '12px' 
              }}>
                {[
                  { key: 'soap', label: 'Consultation Notes' },
                  { key: 'vax', label: 'Vaccines' },
                  { key: 'weight', label: 'Weights' },
                  { key: 'followup', label: 'Follow-ups' }
                ].map(tab => (
                  <button 
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setHistoryTab(tab.key);
                      if (tab.key === 'followup' && typeof reload === 'function') {
                        reload(true);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: historyTab === tab.key ? '2px solid var(--brand)' : '2px solid transparent',
                      color: historyTab === tab.key ? 'var(--brand)' : 'var(--text-3)',
                      fontWeight: historyTab === tab.key ? '700' : '500',
                      fontSize: '12px',
                      padding: '4px 2px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ maxHeight: 'calc(100vh - 260px)', minHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                {historyTab === 'soap' && (
                  petHistory.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '8px' }}>
                      {petHistory.map((note, idx) => {
                        const isExpanded = expandedHistoryId === (note._id || idx);
                        return (
                          <div key={note._id || idx} style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #22c55e', background: '#fff', zIndex: 1, marginTop: '2px' }}></div>
                              {idx < petHistory.length - 1 && <div style={{ flex: 1, width: '2px', background: '#e2e8f0', margin: '4px 0' }}></div>}
                            </div>
                            <div style={{ flex: 1, paddingBottom: '24px' }}>
                              <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => setExpandedHistoryId(isExpanded ? null : (note._id || idx))}
                              >
                                <span style={{ color: '#94a3b8', fontSize: '10px', width: '12px', textAlign: 'center', display: 'inline-block' }}>{isExpanded ? '▼' : '▶'}</span>
                                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{new Date(note.createdAt || note.date || activeAppointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                                <span style={{ fontSize: '13px', color: '#64748b' }}>{note.vetName || 'Dr. Shivam Sharma'}</span>
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>completed</span>
                              </div>
                              
                              {isExpanded && (
                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#334155', fontSize: '13px', lineHeight: '1.5', paddingLeft: '22px' }}>
                                  <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Summary</div>
                                    <div>{note.subjective || note.assessment}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Chief Complaint</div>
                                    <div>{note.chiefComplaint || 'Consultation visit'}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Diagnosis</div>
                                    <div>{note.diagnosis || note.assessment}</div>
                                  </div>
                                  {note.prescription && note.prescription.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Prescription</div>
                                      <div style={{ width: '100%', overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                          <thead>
                                            <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                                              <th style={{ paddingBottom: '8px', fontWeight: '500' }}>Medicine</th>
                                              <th style={{ paddingBottom: '8px', fontWeight: '500' }}>Dosage</th>
                                              <th style={{ paddingBottom: '8px', fontWeight: '500' }}>Frequency</th>
                                              <th style={{ paddingBottom: '8px', fontWeight: '500' }}>Duration</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {note.prescription.map((rx, rIdx) => (
                                              <tr key={rIdx}>
                                                <td style={{ padding: '8px 0', color: '#334155' }}>{rx.medicine_name || rx.name}</td>
                                                <td style={{ padding: '8px 0', color: '#334155' }}>{rx.dosage}</td>
                                                <td style={{ padding: '8px 0', color: '#334155' }}>{rx.frequency}</td>
                                                <td style={{ padding: '8px 0', color: '#334155' }}>{rx.duration}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {note.follow_up_date && (
                                    <div>
                                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Follow-up</div>
                                      <div>{new Date(note.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} <span style={{ color: '#94a3b8', fontSize: '12px' }}>(pending)</span></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                      No previous consultations found. This is a first-time patient.
                    </div>
                  )
                )}

                {historyTab === 'vax' && (
                  petVax.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {petVax.map((v, idx) => (
                        <div key={v._id || idx} style={{ borderBottom: idx < petVax.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{v.vaccine || v.name}</strong>
                            <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                              <span style={{ display: 'inline-block', width: '180px', flexShrink: 0 }}>Last Given: {v.lastDate ? formatDateClean(v.lastDate) : '—'}</span>
                              <span style={{ marginRight: '8px' }}>•</span>
                              <span>Due: {v.displayStatus === 'Not recorded' ? '—' : formatDateClean(v.dueDate || v.date)}</span>
                            </span>
                          </div>
                           <span className={`badge b-${getBadgeColor(v.displayStatus)}`} style={{ fontSize: '10px' }}>
                             {v.displayStatus || 'Due'}
                           </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                      No vaccination history found for {activePet.name}.
                    </div>
                  )
                )}

                {historyTab === 'weight' && (
                  petWeights.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const sortedWeights = [...petWeights].sort((a,b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
                        const chartData = sortedWeights.map(w => ({
                          date: new Date(w.date || w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          weight: parseFloat(w.value || w.weight) || 0
                        }));
                        const currentWeight = chartData.length > 0 ? chartData[chartData.length - 1].weight : 0;
                        const firstWeight = chartData.length > 0 ? chartData[0].weight : 0;
                        const diff = currentWeight - firstWeight;
                        const diffColor = diff > 0 ? 'var(--amber)' : diff < 0 ? 'var(--green)' : 'var(--text-3)';
                        
                        return (
                          <>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                              <div style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Current Weight</div>
                                {chartData.length > 0 && (
                                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                                    <span style={{ background: 'var(--bg-2)', color: 'var(--text-2)', padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', textTransform: 'none' }}>
                                      Recorded on {new Date(sortedWeights[sortedWeights.length - 1].date || sortedWeights[sortedWeights.length - 1].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  </div>
                                )}
                                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>{currentWeight.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>lbs</span></div>
                              </div>
                              <div style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Total Change</div>
                                <div style={{ fontSize: '20px', fontWeight: '800', color: diffColor }}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>lbs</span></div>
                              </div>
                            </div>
                            <div style={{ height: '180px', width: '100%', marginTop: '8px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-3)' }} dy={5} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ fontWeight: 'bold', color: 'var(--text)', marginBottom: '4px' }}
                                    itemStyle={{ color: 'var(--brand)', fontWeight: '600' }}
                                  />
                                  <Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke="var(--brand)" strokeWidth={3} dot={{ r: 4, fill: 'var(--surface)', stroke: 'var(--brand)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                      No weight history records found for {activePet.name}.
                    </div>
                  )
                )}
                {historyTab === 'followup' && (
                  petFollowups.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {petFollowups.map((f, idx) => (
                        <div key={f._id || idx} style={{ borderBottom: idx < petFollowups.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text)' }}>Follow-up Checkup</strong>
                            <span className="badge b-blue" style={{ fontSize: '10px' }}>
                              {(!(f.confirmedDate || f.planDate) || isNaN(new Date(f.confirmedDate || f.planDate).getTime())) ? f.status : (f.status === 'Completed' ? 'Completed' : 'Scheduled')}
                            </span>
                          </div>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                            {(!(f.confirmedDate || f.planDate) || isNaN(new Date(f.confirmedDate || f.planDate).getTime())) 
                              ? 'Scheduled for follow up soon' 
                              : `Scheduled follow up on ${new Date(f.confirmedDate || f.planDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${f.time || '-'}`
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                      No follow-up appointments scheduled for {activePet.name}.
                    </div>
                  )
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // Stage 2: ACTIVE RECORDING SCREEN
  if (isConsultationStarted && !draft.subjective && !isGenerating) {
    return (
      <div className="main-scroll" style={{ background: '#f1f5f9', height: '100%', overflowY: 'auto', color: '#334155' }}>
        <div className="main-pad" style={{ padding: '24px' }}>
          
          {/* Back Navigation bar */}
          <button 
            className="btn btn-outline" 
            style={{ 
              marginBottom: '20px', 
              padding: '6px 12px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '13px', 
              fontWeight: '700',
              borderColor: '#cbd5e1',
              color: '#475569'
            }} 
            onClick={() => {
              if (recordingIntervalId) {
                clearInterval(recordingIntervalId);
                setRecordingIntervalId(null);
              }
              setIsRecording(false);
              isRecordingRef.current = false;
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.onend = null;
                  recognitionRef.current.stop();
                } catch (e) {}
              }
              setIsConsultationStarted(false);
              setDraft({ subjective: '', objective: '', assessment: '', plan: '' });
              setLiveTranscript([]);
            }}
          >
            ← Back
          </button>

          {/* Dynamic Patient Card Header */}
          <div className="panel" style={{
            display: 'flex',
            gap: '18px',
            alignItems: 'center',
            marginBottom: '22px',
            padding: '16px 20px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(37,99,235,0.1)',
              color: '#3b82f6',
              display: 'grid',
              placeItems: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              {getSpeciesEmoji(activePet.species, activePet.breed)}
            </div>
            <div>
              <strong style={{ fontSize: '18px', color: '#0f172a', display: 'block' }}>
                {activePet.name} (Owner - {activeOwner.name})
              </strong>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '14px' }}>
                <span>{activePet.species || 'Dog'}</span>
                <span>•</span>
                <span>{activeOwner.phone}</span>
                <span>•</span>
                <span>{activeOwner.email}</span>
              </div>
            </div>
          </div>

          <div className="grid-two" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '22px' }}>
            
            {/* LEFT COLUMN: ACTIVE RECORDER */}
            <div className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a', alignSelf: 'flex-start' }}>
                Consultation Recording
              </h3>
              
              <div style={{ fontSize: '48px', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace', marginBottom: '8px' }}>
                {formatTimer(recordTimer)}
              </div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
                {isRecording ? "Recording in progress..." : recordTimer > 0 ? "Recording stopped. Review transcript below." : "Click the mic to start recording"}
              </div>

              <div 
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  background: isRecording ? '#ef4444' : '#3b82f6', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '32px',
                  boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                  marginBottom: '40px',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {isRecording ? '🎙️' : '▶️'}
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Transcript</label>
                <textarea 
                  readOnly
                  value={rawTranscriptText}
                  placeholder="Speak to see transcript appear here..."
                  style={{
                    width: '100%',
                    height: '120px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#334155',
                    fontSize: '13px',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', width: '100%', marginBottom: '20px' }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => {
                    if (recordingIntervalId) {
                      clearInterval(recordingIntervalId);
                      setRecordingIntervalId(null);
                    }
                    setIsRecording(false);
                    isRecordingRef.current = false;
                    if (recognitionRef.current) {
                      try {
                        // override onend to avoid restarts
                        recognitionRef.current.onend = null;
                        recognitionRef.current.stop();
                      } catch (e) {}
                    }
                    setIsConsultationStarted(false);
                    setDraft({ subjective: '', objective: '', assessment: '', plan: '' });
                    setLiveTranscript([]);
                  }}
                  style={{ flex: 1, borderColor: '#cbd5e1', color: '#475569', padding: '12px', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={sendToAI}
                  disabled={!isRecording && recordTimer === 0}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '8px', 
                    fontWeight: '800',
                    background: (!isRecording && recordTimer === 0) ? '#e2e8f0' : '#10b981',
                    borderColor: (!isRecording && recordTimer === 0) ? '#e2e8f0' : '#10b981',
                    color: (!isRecording && recordTimer === 0) ? '#94a3b8' : '#fff',
                    cursor: (!isRecording && recordTimer === 0) ? 'not-allowed' : 'pointer',
                    opacity: (!isRecording && recordTimer === 0) ? 0.5 : 1
                  }}
                >
                  ✉️ Send to AI
                </button>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px' }}>🎤</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#60a5fa', lineHeight: '1.5' }}>
                  <strong>Auto-detects language</strong> - Speak in English, Hindi, or Hinglish. Claude AI will understand and respond in the same language.
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: HISTORICAL VISITS */}
            <div className="panel" style={{ padding: '22px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Visit History
                </h3>
              </div>
              <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                {petHistory && petHistory.length > 0 ? "Past visits available." : "No previous visits found. This is a first-time patient."}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Stage 3: AI REVIEW SCREEN
  return (
    <div className="main-scroll" style={{ background: '#f1f5f9', height: '100%', overflowY: 'auto', color: '#334155' }}>
      <div className="main-pad" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Back Navigation bar */}
        <button 
          className="btn btn-outline" 
          style={{ 
            marginBottom: '20px', 
            padding: '6px 12px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '13px', 
            fontWeight: '700',
            borderColor: '#374151',
            color: '#94a3b8'
          }} 
          onClick={() => {
            setIsConsultationStarted(false);
          }}
        >
          ← Back
        </button>

        {/* Dynamic Patient Card Header */}
        <div className="panel" style={{
          display: 'flex',
          gap: '18px',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px 20px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'rgba(37,99,235,0.1)',
            color: '#3b82f6',
            display: 'grid',
            placeItems: 'center',
            fontSize: '22px',
            flexShrink: 0
          }}>
            {getSpeciesEmoji(activePet.species, activePet.breed)}
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#0f172a', display: 'block' }}>
              {activePet.name} (Owner - {activeOwner.name})
            </strong>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '14px' }}>
              <span>{activePet.species || 'Dog'}</span>
              <span>•</span>
              <span>{activeOwner.phone}</span>
              <span>•</span>
              <span>{activeOwner.email}</span>
            </div>
          </div>
        </div>

        {/* Review Form */}
        <div className="panel" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            Review AI-Generated Consultation
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>
            Review and edit the AI-generated data below before saving.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Patient Summary (Subjective) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Patient Summary <span style={{ color: '#64748b', fontWeight: '400' }}>(what the patient said)</span>
              </label>
              <textarea
                value={draft.subjective || rawTranscriptText || ''}
                onChange={(e) => setDraft({ ...draft, subjective: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: isApproved ? '#f8fafc' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  color: isApproved ? '#94a3b8' : '#334155',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
                disabled={isApproved}
              />
            </div>

            {/* Doctor Summary (Objective & Plan) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Doctor Summary <span style={{ color: '#64748b', fontWeight: '400' }}>(what the doctor said)</span>
              </label>
              <textarea
                value={(draft.objective || '') + '\n\n' + (draft.plan || '')}
                onChange={(e) => {
                  const parts = e.target.value.split('\n\n');
                  setDraft({ ...draft, objective: parts[0] || '', plan: parts.slice(1).join('\n\n') || '' });
                }}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  background: isApproved ? '#f8fafc' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  color: isApproved ? '#94a3b8' : '#334155',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
                disabled={isApproved}
              />
            </div>

            {/* Chief Complaint */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Chief Complaint
              </label>
              <textarea
                value={draft.chief_complaint || activeAppointment.reason || ''}
                readOnly
                style={{
                  width: '100%',
                  minHeight: '60px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#334155',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </div>

            {/* Diagnosis */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Diagnosis
              </label>
              <textarea
                value={draft.assessment || ''}
                onChange={(e) => setDraft({ ...draft, assessment: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  background: isApproved ? '#f8fafc' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  color: isApproved ? '#94a3b8' : '#334155',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
                disabled={isApproved}
              />
            </div>

            {/* Prescriptions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  Prescriptions
                </label>
                <button 
                  onClick={() => {
                    const drugName = prompt("Enter drug name to prescribe:", "Carprofen 50mg");
                    if (drugName) {
                      setDraft(prev => ({
                        ...prev,
                        plan: (prev.plan || '') + '\nPrescribed medication: ' + drugName + '.'
                      }));
                    }
                  }}
                  disabled={isApproved}
                  style={{ color: isApproved ? '#94a3b8' : '#3b82f6', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '600', cursor: isApproved ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>+</span> Add
                </button>
              </div>
              {(draft.prescription && draft.prescription.length > 0 ? draft.prescription : [{ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' }]).map((rx, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <input type="text" placeholder="Medicine name" value={rx.medicine_name || ''} disabled={isApproved} onChange={e => { const newRx = [...(draft.prescription||[])]; if(!newRx[idx]) newRx[idx]={}; newRx[idx].medicine_name = e.target.value; setDraft({...draft, prescription: newRx}) }} style={{ background: isApproved ? '#f1f5f9' : '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', color: isApproved ? '#94a3b8' : '#334155', fontSize: '13px', outline: 'none', cursor: isApproved ? 'not-allowed' : 'text' }} />
                    <input type="text" placeholder="Dosage" value={rx.dosage || ''} disabled={isApproved} onChange={e => { const newRx = [...(draft.prescription||[])]; if(!newRx[idx]) newRx[idx]={}; newRx[idx].dosage = e.target.value; setDraft({...draft, prescription: newRx}) }} style={{ background: isApproved ? '#f1f5f9' : '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', color: isApproved ? '#94a3b8' : '#334155', fontSize: '13px', outline: 'none', cursor: isApproved ? 'not-allowed' : 'text' }} />
                    <input type="text" placeholder="Frequency" value={rx.frequency || ''} disabled={isApproved} onChange={e => { const newRx = [...(draft.prescription||[])]; if(!newRx[idx]) newRx[idx]={}; newRx[idx].frequency = e.target.value; setDraft({...draft, prescription: newRx}) }} style={{ background: isApproved ? '#f1f5f9' : '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', color: isApproved ? '#94a3b8' : '#334155', fontSize: '13px', outline: 'none', cursor: isApproved ? 'not-allowed' : 'text' }} />
                    <input type="text" placeholder="Duration" value={rx.duration || ''} disabled={isApproved} onChange={e => { const newRx = [...(draft.prescription||[])]; if(!newRx[idx]) newRx[idx]={}; newRx[idx].duration = e.target.value; setDraft({...draft, prescription: newRx}) }} style={{ background: isApproved ? '#f1f5f9' : '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', color: isApproved ? '#94a3b8' : '#334155', fontSize: '13px', outline: 'none', cursor: isApproved ? 'not-allowed' : 'text' }} />
                  </div>
                  <input type="text" placeholder="Special instructions" value={rx.instructions || ''} disabled={isApproved} onChange={e => { const newRx = [...(draft.prescription||[])]; if(!newRx[idx]) newRx[idx]={}; newRx[idx].instructions = e.target.value; setDraft({...draft, prescription: newRx}) }} style={{ width: '100%', background: isApproved ? '#f1f5f9' : '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', color: isApproved ? '#94a3b8' : '#334155', fontSize: '13px', outline: 'none', boxSizing: 'border-box', cursor: isApproved ? 'not-allowed' : 'text' }} />
                </div>
              ))}
            </div>

            {/* Follow-up Date */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Follow-up Date
              </label>
              <input 
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={draft.follow_up_date || ''}
                onChange={e => setDraft({...draft, follow_up_date: e.target.value})}
                style={{
                  background: isApproved ? '#f8fafc' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: isApproved ? '#94a3b8' : '#334155',
                  fontSize: '14px',
                  outline: 'none',
                  width: '200px',
                  cursor: isApproved ? 'not-allowed' : 'text'
                }}
                disabled={isApproved}
              />
            </div>
            
          </div>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <button 
              className="btn btn-outline"
              onClick={() => {
                setIsConsultationStarted(false);
              }}
              style={{ flex: 1, borderColor: '#374151', color: '#94a3b8', padding: '12px', borderRadius: '8px', fontWeight: '600' }}
            >
              Back
            </button>
            <button 
              className="btn btn-outline"
              onClick={() => {
                setIsConsultationStarted(false);
                setDraft({ subjective: '', objective: '', assessment: '', plan: '', prescription: [], follow_up_date: '' });
                setLiveTranscript([]);
                setRawTranscriptText('');
              }}
              style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444', padding: '12px', borderRadius: '8px', fontWeight: '600' }}
            >
              Reset
            </button>
            <button 
              className="btn btn-outline"
              onClick={() => {
                setIsApproved(!isApproved);
                if (!isApproved) window.showToast?.("Approved!", "success");
              }}
              style={{ 
                flex: 1, 
                borderColor: isApproved ? '#10b981' : '#3b82f6', 
                color: isApproved ? '#fff' : '#3b82f6', 
                backgroundColor: isApproved ? '#10b981' : 'transparent',
                padding: '12px', 
                borderRadius: '8px', 
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              {isApproved ? '✓ Approved' : 'Approve'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleApprove}
              disabled={isGenerating || !isApproved || isSubmitting}
              style={{ 
                flex: 1, 
                background: (isGenerating || !isApproved || isSubmitting) ? '#374151' : '#10b981', 
                borderColor: (isGenerating || !isApproved || isSubmitting) ? '#374151' : '#10b981', 
                color: (isGenerating || !isApproved || isSubmitting) ? '#9ca3af' : '#fff', 
                padding: '12px', 
                borderRadius: '8px', 
                fontWeight: '800',
                cursor: (isGenerating || !isApproved || isSubmitting) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? 'Sending...' : '✉️ Send to Patient'}
            </button>
          </div>

        </div>

      </div>

      {isSubmitting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>✉️</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Sending to Patient...
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Please wait while we finalize the consultation notes and send them to the patient.
            </p>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="modal-wrap" style={{ display: 'flex', zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', alignItems: 'center', justifyItems: 'center' }}>
          <div className="modal" style={{ 
            width: '400px', 
            background: '#ffffff', 
            color: '#334155', 
            border: '1px solid #e2e8f0',
            padding: '32px',
            borderRadius: '16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            margin: 'auto'
          }}>
            <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>🧠</div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
              Processing with AI...
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Please wait while we analyze the consultation transcript and generate structured consultation notes.
            </p>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="modal-wrap" style={{ display: 'flex', zIndex: 9999 }}>
          <div className="modal" style={{ 
            width: '540px', 
            background: '#ffffff', 
            color: '#334155', 
            border: '1px solid #e2e8f0',
            padding: '28px',
            borderRadius: '16px'
          }}>
            <div className="modal-hd" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎉 Consultation Finalized!
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Consultation record persisted for {activeAppointment.petName}
                </span>
              </div>
              <button 
                className="modal-x" 
                style={{ color: '#64748b', cursor: 'pointer', border: 0, background: 'transparent' }} 
                onClick={() => {
                  setShowSendModal(false);
                  go('calendar');
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowSendModal(false);
                  go('calendar');
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '800' }}
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

