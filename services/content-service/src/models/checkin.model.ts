import mongoose from "mongoose";

const CheckinSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  userId:     { type: String, required: true, index: true },
  location:   { lat: Number, lng: Number },
  distanceMeters: Number,
  method:     { type: String, enum: ["gps","manual","reservation","order"], default: "gps" },
  isDeleted:  { type: Boolean, default: false },
}, { timestamps: true });

CheckinSchema.index({ userId: 1, businessId: 1, createdAt: -1 });

export const Checkin = mongoose.model("Checkin", CheckinSchema);
