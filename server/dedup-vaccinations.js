import 'dotenv/config';
import { connectDb } from './src/db.js';
import { Vaccination } from './src/models.js';

async function run() {
  await connectDb();
  
  const allVaccinations = await Vaccination.find({});
  const seen = new Set();
  const toDelete = [];
  
  for (const v of allVaccinations) {
    // Unique key per pet, owner, clinic, and vaccine type
    // If multiple of the same vaccine are scheduled for the same pet, we assume they are duplicates 
    // unless they have different statuses or something, but for our case, they are exact duplicate generations.
    // Wait, for multiple rounds, they might have different due dates in the future? 
    // Right now, the retroactive generation only generated "Pending" vaccines once based on VaccineMaster.
    // So grouping by petName, ownerName, and vaccine name is sufficient.
    const key = `${v.petName}-${v.ownerName}-${v.clinic_id}-${v.vaccine}`;
    if (seen.has(key)) {
      toDelete.push(v._id);
    } else {
      seen.add(key);
    }
  }
  
  if (toDelete.length > 0) {
    await Vaccination.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${toDelete.length} duplicate vaccination records.`);
  } else {
    console.log(`No duplicates found in vaccinations.`);
  }
  
  process.exit(0);
}
run();
