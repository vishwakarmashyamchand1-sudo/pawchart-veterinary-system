import mongoose from 'mongoose';
import { Client, Vaccination, VaccineMaster } from './src/models.js';
import { generateVaccinesForPets } from './src/utils/vaccineGenerator.js';

mongoose.connect('mongodb://127.0.0.1:27017/pawchart')
  .then(async () => {
    const client = await Client.findOne({ "pets.name": "chady" });
    if (!client) {
      console.log("Client with chady not found");
      process.exit(1);
    }
    
    console.log("Client found:", client.name);
    const chady = client.pets.find(p => p.name === 'chady');
    console.log("Pet chady:", chady);

    try {
      await generateVaccinesForPets([chady], client.name, client.clinic_id);
      console.log("Generated successfully");
    } catch (err) {
      console.error("Error generating:", err);
    }
    process.exit(0);
  })
  .catch(console.error);

