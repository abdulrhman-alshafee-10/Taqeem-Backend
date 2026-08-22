import mongoose from "mongoose";

const GalleryItemSchema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  source:     { type: String, enum: ["review","owner","tip","short"], required: true },
  refId:      String,
  url:        { type: String, required: true, unique: true },
  thumbUrl:   String,
  tags:       { type: [String], default: [] },
  altText:    String,
  score:      { type: Number, default: 0.5 },
  authorId:   String,
  createdAt:  { type: Date, default: Date.now },
}, { versionKey: false });

GalleryItemSchema.index({ businessId: 1, score: -1, createdAt: -1 });

export const GalleryItem = mongoose.model("GalleryItem", GalleryItemSchema);
