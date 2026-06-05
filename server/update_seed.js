import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const vaccineMasterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  recommendedAge: { type: String, required: true },
  desc: { type: String }
}, { timestamps: true });

const VaccineMaster = mongoose.models.VaccineMaster || mongoose.model('VaccineMaster', vaccineMasterSchema);

async function seed() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';
    await mongoose.connect(uri);
    
    const coreVaccines = [
      { name: 'Rabies', species: 'Dog', recommendedAge: '12 weeks', desc: 'Prevents fatal rabies infection.' },
      { name: 'DHPP', species: 'Dog', recommendedAge: '8 weeks', desc: 'Protects against major canine viral diseases.' },
      { name: 'Bordetella', species: 'Dog', recommendedAge: '12 weeks', desc: 'Prevents kennel cough infection.' },
      { name: 'Rabies', species: 'Cat', recommendedAge: '12 weeks', desc: 'Prevents fatal rabies infection.' },
      { name: 'FVRCP', species: 'Cat', recommendedAge: '8 weeks', desc: 'Protects against core feline viral diseases.' },
      { name: 'RHDV2', species: 'Rabbit', recommendedAge: '6 weeks', desc: 'Protects against rabbit hemorrhagic disease.' },
      { name: 'Polyomavirus', species: 'Bird', recommendedAge: '4 weeks', desc: 'Protects against avian polyomavirus infection.' }
    ];

    for (const vax of coreVaccines) {
      await VaccineMaster.updateOne(
        { name: vax.name, species: vax.species },
        { $set: { desc: vax.desc, recommendedAge: vax.recommendedAge } },
        { upsert: true }
      );
      console.log(`Updated/Created ${vax.name} for ${vax.species}`);
    }
    console.log('Update complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
