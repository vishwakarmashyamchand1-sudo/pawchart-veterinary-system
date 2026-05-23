import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

export async function connectDb(uri) {
  const primaryUri = uri || MONGO_URI;
  const options = {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s for fast fallback trigger
    socketTimeoutMS: 45000,
  };

  try {
    console.log("⏳ Connecting to primary MongoDB...");
    mongoose.set("strictQuery", true);
    await mongoose.connect(primaryUri, options);
    console.log("✅ MongoDB Connected Successfully to primary database");
  } catch (error) {
    console.warn("⚠️ Primary MongoDB Connection Failed: " + error.message);
    const fallbackUri = 'mongodb://127.0.0.1:27017/pawchart';
    if (primaryUri !== fallbackUri) {
      console.log("🔄 Engaging resilient local MongoDB fallback connection...");
      try {
        await mongoose.connect(fallbackUri, {
          autoIndex: true,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        });
        console.log("✅ Connected successfully to local fallback database!");
      } catch (fallbackError) {
        console.error("❌ Local fallback MongoDB connection also failed!");
        console.error(fallbackError.message);
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }
}

mongoose.connection.on('connected', () => {
  console.log('Mongoose connection established successfully.');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error event: ' + err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose connection disconnected event.');
});

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('Mongoose connection closed gracefully due to application exit.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing Mongoose connection gracefully:', err);
    process.exit(1);
  }
});
