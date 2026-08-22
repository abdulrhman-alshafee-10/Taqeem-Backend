import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://taqeem:taqeem_pw@mongo:27017/taqeem_content?authSource=admin";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB (Content)");
}
