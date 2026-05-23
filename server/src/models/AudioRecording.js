import mongoose from 'mongoose';

const audioRecordingSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
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
    transcript: {
      type: String,
      default: ''
    },
    duration_seconds: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['recording', 'transcribed', 'processed', 'failed'],
      default: 'recording'
    }
  },
  {
    timestamps: true
  }
);

audioRecordingSchema.index({ appointment_id: 1 });

const AudioRecording = mongoose.model('AudioRecording', audioRecordingSchema);
export default AudioRecording;
