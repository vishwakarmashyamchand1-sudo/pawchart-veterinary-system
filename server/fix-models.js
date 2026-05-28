import fs from 'fs';

let content = fs.readFileSync('src/models.js', 'utf8');

// I know that the broken part starts after `  { timestamps: true }`
// and ends right before `const weightLogSchema = new Schema(`

const parts = content.split('const weightLogSchema = new Schema(');
const beforeBroken = parts[0].substring(0, parts[0].lastIndexOf('  { timestamps: true }') + 24);

const replacement = `
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
    vetName: String,
    notes: String,
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
    reminderSent: { type: Boolean, default: false },
    clinic_id: { type: Schema.Types.ObjectId, ref: 'Clinic' }
  },
  { timestamps: true }
);

const weightLogSchema = new Schema(`;

const newContent = beforeBroken + replacement + parts[1];
fs.writeFileSync('src/models.js', newContent);
console.log('Fixed models.js');
