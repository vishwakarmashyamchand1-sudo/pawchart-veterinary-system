import 'dotenv/config';
import { connectDb } from './src/db.js';
import { Client, Vaccination, Appointment, FollowUp, WeightLog, SoapNote } from './src/models.js';

async function run() {
  await connectDb();
  
  const clients = await Client.find({});
  const clientMap = new Map(clients.map(c => [c.name.toLowerCase(), c]));
  
  // Clean up Appointments
  const allAppointments = await Appointment.find({});
  let aDeleted = 0;
  for (const a of allAppointments) {
    const client = clientMap.get(a.ownerName.toLowerCase());
    if (!client) {
      await Appointment.findByIdAndDelete(a._id);
      aDeleted++;
      continue;
    }
    const petExists = client.pets.some(p => p.name.toLowerCase() === a.petName.toLowerCase());
    if (!petExists) {
      await Appointment.findByIdAndDelete(a._id);
      aDeleted++;
    }
  }

  // Clean up Vaccinations
  const allVaccinations = await Vaccination.find({});
  let vDeleted = 0;
  for (const v of allVaccinations) {
    const client = clientMap.get(v.ownerName.toLowerCase());
    if (!client) {
      await Vaccination.findByIdAndDelete(v._id);
      vDeleted++;
      continue;
    }
    const petExists = client.pets.some(p => p.name.toLowerCase() === v.petName.toLowerCase());
    if (!petExists) {
      await Vaccination.findByIdAndDelete(v._id);
      vDeleted++;
    }
  }

  // Clean up FollowUps
  const allFollowUps = await FollowUp.find({});
  let fDeleted = 0;
  for (const f of allFollowUps) {
    const client = clientMap.get(f.ownerName.toLowerCase());
    if (!client) {
      await FollowUp.findByIdAndDelete(f._id);
      fDeleted++;
      continue;
    }
    const petExists = client.pets.some(p => p.name.toLowerCase() === f.petName.toLowerCase());
    if (!petExists) {
      await FollowUp.findByIdAndDelete(f._id);
      fDeleted++;
    }
  }

  // Clean up WeightLogs
  const allWeightLogs = await WeightLog.find({});
  let wDeleted = 0;
  for (const w of allWeightLogs) {
    const client = clientMap.get(w.ownerName.toLowerCase());
    if (!client) {
      await WeightLog.findByIdAndDelete(w._id);
      wDeleted++;
      continue;
    }
    const petExists = client.pets.some(p => p.name.toLowerCase() === w.petName.toLowerCase());
    if (!petExists) {
      await WeightLog.findByIdAndDelete(w._id);
      wDeleted++;
    }
  }

  // Clean up SoapNotes
  const allSoapNotes = await SoapNote.find({});
  let sDeleted = 0;
  for (const sn of allSoapNotes) {
    const client = clientMap.get(sn.ownerName.toLowerCase());
    if (!client) {
      await SoapNote.findByIdAndDelete(sn._id);
      sDeleted++;
      continue;
    }
    const petExists = client.pets.some(p => p.name.toLowerCase() === sn.petName.toLowerCase());
    if (!petExists) {
      await SoapNote.findByIdAndDelete(sn._id);
      sDeleted++;
    }
  }

  console.log(`Cleaned up ${aDeleted} orphaned appointments.`);
  console.log(`Cleaned up ${vDeleted} orphaned vaccinations.`);
  console.log(`Cleaned up ${fDeleted} orphaned follow-ups.`);
  console.log(`Cleaned up ${wDeleted} orphaned weight logs.`);
  console.log(`Cleaned up ${sDeleted} orphaned SOAP notes.`);
  
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
