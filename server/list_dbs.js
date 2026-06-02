import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

async function listDbs() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully to MongoDB.");

    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log("\n--- DATABASES ON CLUSTER ---");
    dbs.databases.forEach(db => {
      console.log(`- Name: ${db.name} | Size: ${db.sizeOnDisk} bytes | Empty: ${db.empty}`);
    });

  } catch (err) {
    console.error("Error listing databases:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listDbs();
