import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const petSchema = new Schema(
  {
    name: { type: String, required: true },
    species: { type: String, required: true },
    breed: String,
    emoji: String,
    age: String,
    sex: String,
    color: String,
    microchip: String,
    weightRange: String,
    alerts: [String],
    petId: String,
    dateOfBirth: String,
    insurance: String,
    primaryVet: String,
    bloodType: String,
    spayedNeutered: String
  },
  { _id: true }
);

const clientSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    address: String,
    pets: [petSchema],
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const vetSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    specialization: String,
    license: String,
    experienceYears: Number,
    consultationFee: Number,
    status: { type: String, default: 'Available' },
    room: String,
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const appointmentSchema = new Schema(
  {
    petName: { type: String, required: true },
    ownerName: { type: String, required: true },
    species: String,
    breed: String,
    vetName: String,
    reason: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    type: { type: String, default: 'Checkup' },
    status: { type: String, default: 'Scheduled' },
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const vaccinationSchema = new Schema(
  {
    petName: String,
    ownerName: String,
    breed: String,
    vaccine: String,
    lastDate: String,
    dueDate: String,
    status: String,
    reminderStatus: String,
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const followUpSchema = new Schema(
  {
    petName: String,
    ownerName: String,
    vetName: String,
    purpose: String,
    planDate: String,
    confirmedDate: String,
    time: String,
    priority: String,
    status: String,
    monitoring: Boolean,
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const weightLogSchema = new Schema(
  {
    petName: String,
    ownerName: String,
    value: Number,
    unit: { type: String, default: 'lbs' },
    date: String,
    note: String,
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const soapNoteSchema = new Schema(
  {
    petName: String,
    ownerName: String,
    vetName: String,
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
    tags: [String],
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

export const Client = model('Client', clientSchema);
export const Vet = model('Vet', vetSchema);
export const Appointment = model('Appointment', appointmentSchema);
export const Vaccination = model('Vaccination', vaccinationSchema);
export const FollowUp = model('FollowUp', followUpSchema);
export const WeightLog = model('WeightLog', weightLogSchema);
export const SoapNote = model('SoapNote', soapNoteSchema);
