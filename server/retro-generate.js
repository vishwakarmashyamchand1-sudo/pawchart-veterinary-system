import 'dotenv/config';
import { connectDb } from './src/db.js';
import { Client, Vaccination, VaccineMaster } from './src/models.js';
import { calculateDueDate } from './src/utils/dateCalculator.js';

async function run() {
  await connectDb();
  const clients = await Client.find({});
  let total = 0;
  for(const c of clients){
    for(const p of c.pets){
      const count = await Vaccination.countDocuments({ petName: p.name, ownerName: c.name });
      if(count===0 && p.dateOfBirth){
        console.log(`Checking pet: ${p.name}, species: ${p.species}`);
        
        // Handle "Mixed Breed" and other custom inputs by falling back to 'Dog'
        // In the UI, 'species' can be 'Other', but here we need to map to master vaccines
        // If it's a known string but not matching exactly, let's normalize it.
        let searchSpecies = p.species || 'Dog';
        if (searchSpecies.toLowerCase().includes('dog') || searchSpecies.toLowerCase().includes('mixed breed')) {
          searchSpecies = 'Dog';
        } else if (searchSpecies.toLowerCase().includes('cat')) {
          searchSpecies = 'Cat';
        }

        const mvs = await VaccineMaster.find({ species: { $regex: new RegExp('^'+searchSpecies+'$', 'i') } });
        
        if (mvs.length > 0) {
          const vx=[];
          for(const mv of mvs){
            const dd = calculateDueDate(p.dateOfBirth, mv.recommendedAge);
            if(dd) vx.push({ petName: p.name, ownerName: c.name, breed: p.breed, vaccine: mv.name, dueDate: dd, status: 'Pending', clinic_id: c.clinic_id });
          }
          if(vx.length>0) {
            await Vaccination.insertMany(vx);
            console.log(`Generated ${vx.length} vaccines for ${p.name}`);
            total += vx.length;
          }
        } else {
          console.log(`No master vaccines found for species: ${searchSpecies}`);
        }
      }
    }
  }
  console.log(`Total generated: ${total}`);
  process.exit(0);
}
run();
