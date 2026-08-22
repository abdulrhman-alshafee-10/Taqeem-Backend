import mongoose from "mongoose";
import { OutboxSchema } from "@taqeem/shared/outbox/mongoOutbox.js";

export const OutboxEvent = mongoose.model("OutboxEvent", OutboxSchema);
