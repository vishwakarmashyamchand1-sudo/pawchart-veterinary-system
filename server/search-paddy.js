import { connectDb } from './src/db.js';
import { Client } from './src/models.js';

async function run() {
  await connectDb();
  const clients = await Client.find({});
  let found = false;
  for(const c of clients){
    for(const p of c.pets){
      if (p.name.toLowerCase().includes('paddy')) {
        console.log(`Found paddy: Client: ${c.name}, Pet: ${p.name}, Species: ${p.species}, DOB: ${p.dateOfBirth}`);
        found = true;
      }
    }
  }
  if (!found) console.log('paddy not found');
  process.exit(0);
}
run();
