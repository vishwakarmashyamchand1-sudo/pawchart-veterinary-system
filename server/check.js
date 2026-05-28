import mongoose from 'mongoose';
import { VaccineMaster, Client } from './src/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const vaxes = await VaccineMaster.find({});
  console.log('--- VACCINE MASTER LIST ---');
  vaxes.forEach(v => console.log(`Species: "${v.species}" | Name: "${v.name}"`));
  
  const client = await Client.findOne({ "pets.name": "yuo" });
  if (client) {
    const pet = client.pets.find(p => p.name === 'yuo');
    console.log('\n--- PET DATA ---');
    console.log(`Pet Name: "${pet.name}"`);
    console.log(`Pet Species: "${pet.species}"`);
    console.log(`Pet DOB: "${pet.dateOfBirth}"`);
  } else {
    console.log('\nPet yuo not found');
  }
  
  process.exit(0);
}
run();
