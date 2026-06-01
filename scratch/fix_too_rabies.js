import 'dotenv/config';
import { connectDb } from '../server/src/db.js';
import { Vaccination } from '../server/src/models.js';

await connectDb(process.env.MONGO_URI);

// Find the completed rabies record for pet too
const v = await Vaccination.findOne({
  petName: { $regex: /^too$/i },
  vaccine: { $regex: /^rabies$/i }
});

if (v) {
  console.log('Current too Rabies record:', v);
  // Set the next due date based on date of birth schedule (DOB: 2026-05-19 + 12 weeks + 1 year = 2027-08-11)
  v.dueDate = '2027-08-11';
  await v.save();
  console.log('Updated too Rabies record:', v);
} else {
  console.log('too Rabies record not found.');
}

process.exit(0);
