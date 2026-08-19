import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://taqeem:taqeem_pw@mongo:27017/taqeem_reviews?authSource=admin";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 50,
  });
  console.log("mongo connected");
}
