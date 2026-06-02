import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

async function search() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    const db = mongoose.connection.db;

    // Search vetName, doctorName, vet, doctor fields in consultations
    const consultVets = await db.collection('aiconsultations').distinct('vetName');
    console.log("\n--- VET NAMES IN AI CONSULTATIONS ---");
    console.log(consultVets);

    // Search soapNotes vetName
    const soapVets = await db.collection('soapnotes').distinct('vetName');
    console.log("\n--- VET NAMES IN SOAP NOTES ---");
    console.log(soapVets);

    // Let's search all distinct vetNames across other collections if they exist
    const apptVets = await db.collection('appointments').distinct('vetName');
    console.log("\n--- VET NAMES IN APPOINTMENTS ---");
    console.log(apptVets);

    // Let's query one aiconsultation matching "kumar" case-insensitively
    const kumarConsult = await db.collection('aiconsultations').findOne({
      $or: [
        { vetName: /kumar/i },
        { transcript: /kumar/i },
        { summary: /kumar/i },
        { "soap.subjective": /kumar/i }
      ]
    });
    console.log("\n--- KUMAR CONSULT SAMPLE ---");
    console.log(kumarConsult);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

search();
