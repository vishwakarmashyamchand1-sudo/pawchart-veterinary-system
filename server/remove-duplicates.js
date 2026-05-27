import 'dotenv/config';
import { connectDb } from './src/db.js';
import { VaccineMaster } from './src/models.js';

async function run() {
  await connectDb();
  
  const allVaccines = await VaccineMaster.find({});
  const seen = new Set();
  const toDelete = [];
  
  for (const v of allVaccines) {
    const key = `${v.name.toLowerCase()}-${v.species.toLowerCase()}`;
    if (seen.has(key)) {
      toDelete.push(v._id);
    } else {
      seen.add(key);
    }
  }
  
  if (toDelete.length > 0) {
    await VaccineMaster.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${toDelete.length} duplicate vaccine master records.`);
  } else {
    console.log(`No duplicates found.`);
  }
  
  process.exit(0);
}
run();
