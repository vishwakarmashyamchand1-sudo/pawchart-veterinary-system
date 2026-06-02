import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const vaxes = await db.collection('vaccinations').find().sort({_id: -1}).limit(5).toArray();
  console.log(JSON.stringify(vaxes, null, 2));
  process.exit(0);
}
run();
