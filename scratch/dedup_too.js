import 'dotenv/config';
import { connectDb } from '../server/src/db.js';
import { Vaccination } from '../server/src/models.js';

await connectDb(process.env.MONGO_URI);

const allVax = await Vaccination.find({}).lean();
const completedKeys = new Set();

// Step 1: Identify all completed/waived keys
for (const v of allVax) {
  if (v.status === 'Completed' || v.status === 'Waived' || v.lastDate) {
    const key = `${v.petName?.toLowerCase()}_${v.ownerName?.toLowerCase()}_${v.vaccine?.toLowerCase()}`;
    completedKeys.add(key);
  }
}

// Step 2: Delete pending duplicates
let deletedCount = 0;
for (const v of allVax) {
  if (v.status === 'Pending' || v.status === 'Not recorded') {
    const key = `${v.petName?.toLowerCase()}_${v.ownerName?.toLowerCase()}_${v.vaccine?.toLowerCase()}`;
    if (completedKeys.has(key)) {
      console.log(`Deleting duplicate pending record for ${v.petName} - ${v.vaccine}`);
      await Vaccination.findByIdAndDelete(v._id);
      deletedCount++;
    }
  }
}

console.log(`Cleaned up ${deletedCount} duplicate pending vaccination records.`);
process.exit(0);
