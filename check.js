import mongoose from 'mongoose';
import { Vaccination } from './server/src/models.js';

mongoose.connect('mongodb://127.0.0.1:27017/pawchart')
  .then(async () => {
    const vaxes = await Vaccination.find({ petName: 'chady' });
    console.log("Vaxes found:", vaxes.length);
    console.log(vaxes);
    process.exit(0);
  })
  .catch(console.error);
