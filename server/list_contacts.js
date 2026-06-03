import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

async function listAll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;

    // 1. Clinics
    const clinics = await db.collection('clinics').find({}).toArray();
    console.log("\n--- CLINICS REGISTERED ---");
    clinics.forEach(c => {
      console.log(`Clinic: "${c.name}" | Email: "${c.contact?.email}" | Phone: "${c.contact?.phone}"`);
    });

    // 2. Vets
    const vets = await db.collection('vets').find({}).toArray();
    console.log("\n--- VETS REGISTERED ---");
    vets.forEach(v => {
      console.log(`Vet: "${v.name}" | Email: "${v.email}" | Phone: "${v.phone}" | Clinic ID: ${v.clinic_id}`);
    });

    // 3. Clients
    const clients = await db.collection('clients').find({}).toArray();
    console.log("\n--- CLIENTS REGISTERED ---");
    clients.forEach(c => {
      console.log(`Client: "${c.name}" | Email: "${c.email}" | Phone: "${c.phone}" | Clinic ID: ${c.clinic_id}`);
    });

    // 4. Users (for authentication)
    const users = await db.collection('users').find({}).toArray();
    console.log("\n--- USERS REGISTERED ---");
    users.forEach(u => {
      console.log(`User: "${u.name || u.email}" | Email: "${u.email}" | Role: "${u.role}" | Clinic ID: ${u.clinic_id}`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listAll();
