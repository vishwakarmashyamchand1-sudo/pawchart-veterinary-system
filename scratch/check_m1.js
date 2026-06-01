import 'dotenv/config';
import { connectDb } from '../server/src/db.js';
import { Vaccination } from '../server/src/models.js';

const mongoUri = process.env.MONGO_URI;
console.log('Connecting to MONGO_URI:', mongoUri);
await connectDb(mongoUri);
const vaxes = await Vaccination.find({ petName: { $regex: /^m1$/i } }).lean();
console.log('M1 Vaccinations in DB:', JSON.stringify(vaxes, null, 2));
process.exit(0);
