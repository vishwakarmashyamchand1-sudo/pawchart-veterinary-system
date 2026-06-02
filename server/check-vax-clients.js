import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clientSchema = new mongoose.Schema({ name: String, email: String }, { strict: false });
const vaccinationSchema = new mongoose.Schema({ ownerName: String, petName: String, vaccine: String }, { strict: false });

const Client = mongoose.model('Client', clientSchema);
const Vaccination = mongoose.model('Vaccination', vaccinationSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  const vaxes = await Vaccination.find().limit(5);
  for (const v of vaxes) {
    console.log(`Vaccination [${v._id}]: ownerName = '${v.ownerName}'`);
    if (v.ownerName) {
      const client = await Client.findOne({ name: { $regex: new RegExp('^' + v.ownerName.trim() + '$', 'i') } });
      if (client) {
        console.log(`  -> Found Client: ${client.name} | Email: ${client.email}`);
      } else {
        console.log(`  -> NO CLIENT FOUND for ownerName: '${v.ownerName}'`);
      }
    }
  }

  mongoose.disconnect();
}

check();
