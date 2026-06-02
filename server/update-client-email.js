import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clientSchema = new mongoose.Schema({ name: String, email: String }, { strict: false });
const Client = mongoose.model('Client', clientSchema);

async function update() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const targetEmail = process.env.EMAIL_USER;
  
  // Update James Martinez
  const result = await Client.updateOne(
    { name: 'James Martinez' },
    { $set: { email: targetEmail } }
  );

  console.log("Updated James Martinez's email to:", targetEmail, "| Result:", result);

  mongoose.disconnect();
}

update();
