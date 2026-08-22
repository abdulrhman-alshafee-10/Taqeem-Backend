import mongoose from "mongoose";

export const OutboxSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  routingKey:  { type: String, required: true },
  payload:     { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt:   { type: Date, default: Date.now },
  publishedAt: { type: Date, default: null },
  attempts:    { type: Number, default: 0 },
});

// Purge published events after 7 days
OutboxSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { publishedAt: { $ne: null } } });
OutboxSchema.index({ publishedAt: 1, createdAt: 1 }); // poller query
