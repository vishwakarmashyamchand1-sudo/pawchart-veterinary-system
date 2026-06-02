import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clientSchema = new mongoose.Schema({ name: String, email: String }, { strict: false });
const Client = mongoose.model('Client', clientSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const targetEmail = process.env.EMAIL_USER;
  console.log("Looking for client with email:", targetEmail);
  const client = await Client.findOne({ email: targetEmail });
  if (client) {
    console.log("Found client:", client.name);
  } else {
    console.log("No client found with that email!");
  }

  mongoose.disconnect();
}

check();
