import 'dotenv/config';
import { connectDb } from './db.js';
import { Appointment, Client, FollowUp, SoapNote, Vaccination, Vet, WeightLog } from './models.js';
import { seedData } from './data.js';

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

try {
  await connectDb(mongoUri);
} catch (error) {
  console.error(`Could not connect to MongoDB at ${mongoUri}. Start your local MongoDB service or update server/.env with a MongoDB Atlas URI.`);
  console.error(error.message);
  process.exit(1);
}
await Promise.all([
  Vet.deleteMany({}),
  Client.deleteMany({}),
  Appointment.deleteMany({}),
  Vaccination.deleteMany({}),
  FollowUp.deleteMany({}),
  WeightLog.deleteMany({}),
  SoapNote.deleteMany({})
]);

const d = new Date();
const year = d.getFullYear();
const month = String(d.getMonth() + 1).padStart(2, '0');
const date = String(d.getDate()).padStart(2, '0');
const todayStr = `${year}-${month}-${date}`;

const tom = new Date(d);
tom.setDate(d.getDate() + 1);
const tomYear = tom.getFullYear();
const tomMonth = String(tom.getMonth() + 1).padStart(2, '0');
const tomDate = String(tom.getDate()).padStart(2, '0');
const tomorrowStr = `${tomYear}-${tomMonth}-${tomDate}`;

const dynamicAppointments = seedData.appointments.map(appt => {
  let newDate = appt.date;
  if (appt.date === '2026-05-22') {
    newDate = todayStr;
  } else if (appt.date === '2026-05-23') {
    newDate = tomorrowStr;
  }
  return { ...appt, date: newDate };
});

await Promise.all([
  Vet.insertMany(seedData.vets),
  Client.insertMany(seedData.clients),
  Appointment.insertMany(dynamicAppointments),
  Vaccination.insertMany(seedData.vaccinations),
  FollowUp.insertMany(seedData.followUps),
  WeightLog.insertMany(seedData.weights),
  SoapNote.insertMany(seedData.soapNotes)
]);

console.log('Seeded PawChart demo data.');
process.exit(0);
