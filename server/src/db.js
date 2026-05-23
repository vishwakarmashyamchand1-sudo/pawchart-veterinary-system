import mongoose from "mongoose";

export async function connectDb(uri) {
  try {
    console.log("⏳ Connecting to MongoDB...");

    mongoose.set("strictQuery", true);

    await mongoose.connect(uri);

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.log("❌ MongoDB Connection Failed");
    console.log(error.message);
    throw error;
  }
}