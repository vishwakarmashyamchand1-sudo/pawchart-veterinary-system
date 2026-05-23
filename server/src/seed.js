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

await Promise.all([
  Vet.insertMany(seedData.vets),
  Client.insertMany(seedData.clients),
  Appointment.insertMany(seedData.appointments),
  Vaccination.insertMany(seedData.vaccinations),
  FollowUp.insertMany(seedData.followUps),
  WeightLog.insertMany(seedData.weights),
  SoapNote.insertMany(seedData.soapNotes)
]);

console.log('Seeded PawChart demo data.');
process.exit(0);
