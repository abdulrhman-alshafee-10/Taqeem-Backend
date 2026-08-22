import mongoose from "mongoose";

const JournalStopSchema = new mongoose.Schema({
  businessId: String,
  order: Number,
  note: { type: String, maxlength: 500 },
  photos: [{ url: String, caption: String }],
}, { _id: false });

const JournalSchema = new mongoose.Schema({
  authorId:  { type: String, required: true, index: true },
  title:     { type: String, required: true, maxlength: 140 },
  intro:     { type: String, maxlength: 1000 },
  stops:     { type: [JournalStopSchema], validate: (v: any) => v.length >= 2 && v.length <= 20 },
  city:      String,
  tags:      { type: [String], default: [] },
  coverUrl:  String,
  visibility:{ type: String, enum: ["private","unlisted","public"], default: "public" },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

JournalSchema.index({ visibility: 1, city: 1, createdAt: -1 });

export const Journal = mongoose.model("Journal", JournalSchema);
