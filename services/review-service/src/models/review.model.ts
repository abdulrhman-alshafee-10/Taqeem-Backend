import mongoose from "mongoose";
import { franc } from "franc-min";

const MediaSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    type:     { type: String, enum: ["image", "video"], required: true },
    width:    Number,
    height:   Number,
    durationSec: Number,
    caption:  { type: String, maxlength: 240 },
    // AI-generated
    tags:        { type: [String], default: [] },
    altText:     { type: String, maxlength: 240 },
    altTextGenerated: { type: String, maxlength: 240 },
    moderation:  {
      verdict:    { type: String, enum: ["approved", "pending", "rejected"], default: "pending" },
      reason:     String,
      checkedAt:  Date,
    },
  },
  { _id: false }
);

const AspectsSchema = new mongoose.Schema(
  {
    food:        { type: Number, min: 1, max: 5 },
    service:     { type: Number, min: 1, max: 5 },
    ambience:    { type: Number, min: 1, max: 5 },
    value:       { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
  },
  { _id: false }
);

const VerificationSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["reservation", "order", "checkin", "receipt", "none"],
      default: "none",
    },
    refId:      String,
    verifiedAt: Date,
    weight:     { type: Number, default: 0 },
  },
  { _id: false }
);

const VoteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    vote:   { type: Number, enum: [-1, 1], required: true },
    at:     { type: Date, default: Date.now },
  },
  { _id: false }
);

const ThreadMessageSchema = new mongoose.Schema(
  {
    role:      { type: String, enum: ["owner", "author"], required: true },
    userId:    { type: String, required: true },
    body:      { type: String, minlength: 1, maxlength: 2000, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true, index: true },
    authorId:   { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    rating:     { type: Number, required: true, min: 1, max: 5 },
    aspects:    { type: AspectsSchema, default: null },
    title:      { type: String, maxlength: 140 },
    body:       { type: String, required: true, minlength: 10, maxlength: 5000 },
    
    // Phase 7.1: Media-First
    media:      { type: [MediaSchema], default: [] },
    hasMedia:   { type: Boolean, default: false, index: true },
    tags:       { type: [String], default: [] },
    
    // Phase 7.2: Verified Visits & Structured Facts
    verification: { type: VerificationSchema, default: () => ({ source: "none" }) },
    facts: {
      orderedItems: { type: [String], default: [] },
      wouldReturn:  { type: Boolean, default: null },
      visitTime:    { type: String, enum: ["breakfast", "lunch", "dinner", "late_night", null], default: null },
      partySize:    { type: Number, min: 1, max: 20 },
      waitMin:      { type: Number, min: 0, max: 240 },
      spendPerPerson: { type: Number, min: 0 },
    },

    // Phase 7.3: Helpful Voting
    votes: { type: [VoteSchema], default: [] },
    helpfulCount:    { type: Number, default: 0, index: true },
    unhelpfulCount:  { type: Number, default: 0 },

    // Phase 7.4: Language & Threads
    language: { type: String, enum: ["ar", "en", "tr", "fr", "und"], default: "und", index: true },
    thread: { type: [ThreadMessageSchema], default: [] },
    threadClosed: { type: Boolean, default: false },

    // Phase 13.2: AI Aspect Sentiment
    inferredAspects: { type: AspectsSchema, default: null },

    // Moderation
    isFlagged:  { type: Boolean, default: false, index: true },
    isDeleted:  { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false }
);

// One review per (business, author)
ReviewSchema.index({ businessId: 1, authorId: 1 }, { unique: true });
// List queries by business, newest first
ReviewSchema.index({ businessId: 1, createdAt: -1 });

ReviewSchema.pre("save", function (next) {
  if (this.isModified("body") || this.isNew) {
    const code = franc(this.body || "", { minLength: 5 });
    this.language = code === "arb" ? "ar" : code === "eng" ? "en" : "und";
  }
  next();
});

export const Review = mongoose.model("Review", ReviewSchema);
