import 'dotenv/config';
import { connectDb } from './src/db.js';
import { Client, Vaccination, Appointment, FollowUp } from './src/models.js';

async function run() {
  await connectDb();
  
  const clients = await Client.find({});
  const activeOwners = new Set(clients.map(c => c.name));
  
  const allVaccinations = await Vaccination.find({});
  let vDeleted = 0;
  for (const v of allVaccinations) {
    if (!activeOwners.has(v.ownerName)) {
      await Vaccination.findByIdAndDelete(v._id);
      vDeleted++;
    }
  }

  const allAppointments = await Appointment.find({});
  let aDeleted = 0;
  for (const a of allAppointments) {
    if (!activeOwners.has(a.ownerName)) {
      await Appointment.findByIdAndDelete(a._id);
      aDeleted++;
    }
  }

  console.log(`Cleaned up ${vDeleted} orphaned vaccinations.`);
  console.log(`Cleaned up ${aDeleted} orphaned appointments.`);
  
  process.exit(0);
}
run();
