import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    type:     { type: String, enum: ["image", "video"], required: true },
    width:    Number,
    height:   Number,
    caption:  { type: String, maxlength: 240 },
  },
  { _id: false }
);

const ReplySchema = new mongoose.Schema(
  {
    ownerId:   { type: String, required: true },  // UUID from x-user-id
    body:      { type: String, required: true, minlength: 1, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true, index: true },  // UUID
    authorId:   { type: String, required: true, index: true },  // UUID
    authorName: { type: String, required: true },               // denormalized snapshot
    rating:     { type: Number, required: true, min: 1, max: 5 },
    title:      { type: String, maxlength: 140 },
    body:       { type: String, required: true, minlength: 10, maxlength: 5000 },
    media:      { type: [MediaSchema], default: [] },
    tags:       { type: [String], default: [] },

    reply:      { type: ReplySchema, default: null },

    // Moderation
    isFlagged:  { type: Boolean, default: false, index: true },
    isDeleted:  { type: Boolean, default: false, index: true },

    // Engagement counters (updated via events from Analytics)
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

// One review per (business, author)
ReviewSchema.index({ businessId: 1, authorId: 1 }, { unique: true });
// List queries by business, newest first
ReviewSchema.index({ businessId: 1, createdAt: -1 });

export const Review = mongoose.model("Review", ReviewSchema);
