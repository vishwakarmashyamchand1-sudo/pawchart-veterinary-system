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

clientSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const models = mongoose.models;
    const cascadeQuery = { ownerName: doc.name, clinic_id: doc.clinic_id };
    if (models.Appointment) await models.Appointment.deleteMany(cascadeQuery);
    if (models.Vaccination) await models.Vaccination.deleteMany(cascadeQuery);
    if (models.FollowUp) await models.FollowUp.deleteMany(cascadeQuery);
  }
});


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
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    petId: { type: Schema.Types.ObjectId },
    vetId: { type: Schema.Types.ObjectId, ref: 'Vet' },
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
    reminderSent: { type: Boolean, default: false },
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const vaccinationSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    petId: { type: Schema.Types.ObjectId },
    petName: String,
    ownerName: String,
    breed: String,
    vaccine: String,
    lastDate: String,
    dueDate: String,
    status: String,
    reminderStatus: String,
    vetName: String,
    notes: String,
    isRecorded: { type: Boolean, default: false },
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const followUpSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    petId: { type: Schema.Types.ObjectId },
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
    reminderSent: { type: Boolean, default: false },
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const weightLogSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    petId: { type: Schema.Types.ObjectId },
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
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    petId: { type: Schema.Types.ObjectId },
    petName: String,
    ownerName: String,
    vetName: String,
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
    chiefComplaint: String,
    diagnosis: String,
    prescription: [Schema.Types.Mixed],
    tags: [String],
    follow_up_date: String,
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

const vaccineMasterSchema = new Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  recommendedAge: { type: String, required: true },
  desc: { type: String }
}, { timestamps: true });

export const VaccineMaster = model('VaccineMaster', vaccineMasterSchema);

const petCounterSchema = new Schema({
  clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  species_code: { type: String, required: true },
  sequence: { type: Number, default: 0 }
});

petCounterSchema.index({ clinic_id: 1, species_code: 1 }, { unique: true });

export const PetCounter = model('PetCounter', petCounterSchema);
