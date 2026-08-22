import mongoose from "mongoose";

const ShortSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  authorId:   { type: String, required: true, index: true },
  caption:    { type: String, maxlength: 240 },
  videoUrl:   { type: String, required: true },
  thumbUrl:   String,
  durationSec:{ type: Number, required: true, max: 60 },
  tags:       { type: [String], default: [] },
  aspectRatio:{ type: String, default: "9:16" },
  status:     { type: String, enum: ["processing","ready","failed"], default: "processing" },
  viewCount:  { type: Number, default: 0 },
  likeCount:  { type: Number, default: 0 },
}, { timestamps: true });

export const Short = mongoose.model("Short", ShortSchema);
