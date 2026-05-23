import mongoose from 'mongoose';

const aiConsultationSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
    },
    recording_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioRecording'
    },
    vet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vet'
    },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    clinic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic'
    },
    raw_transcript: {
      type: String,
      required: true
    },
    summary: {
      type: String,
      default: ''
    },
    chief_complaint: {
      type: String,
      default: ''
    },
    diagnosis: {
      type: String,
      default: ''
    },
    prescription_data: [
      {
        medicine_name: String,
        dosage: String,
        frequency: String,
        duration: String,
        instructions: String
      }
    ],
    follow_up_date: Date,
    status: {
      type: String,
      enum: ['draft', 'reviewed', 'saved'],
      default: 'draft'
    },
    doctor_edits: {
      summary: String,
      chief_complaint: String,
      diagnosis: String,
      prescription_data: [
        {
          medicine_name: String,
          dosage: String,
          frequency: String,
          duration: String,
          instructions: String
        }
      ],
      follow_up_date: Date
    },
    saved_at: Date
  },
  {
    timestamps: true
  }
);

aiConsultationSchema.index({ appointment_id: 1 });
aiConsultationSchema.index({ status: 1 });

const AIConsultation = mongoose.model('AIConsultation', aiConsultationSchema);
export default AIConsultation;
