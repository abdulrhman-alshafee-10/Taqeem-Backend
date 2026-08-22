import mongoose from "mongoose";

const TipSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  authorId:   { type: String, required: true, index: true },
  body:       { type: String, required: true, minlength: 4, maxlength: 240 },
  photoUrl:   String,
  helpfulCount: { type: Number, default: 0 },
  isDeleted:  { type: Boolean, default: false, index: true },
  language:   { type: String, enum: ["ar","en","und"], default: "und" },
}, { timestamps: true });

export const Tip = mongoose.model("Tip", TipSchema);
