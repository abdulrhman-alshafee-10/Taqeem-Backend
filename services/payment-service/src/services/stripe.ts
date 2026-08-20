import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10",
  timeout: 10_000,
  maxNetworkRetries: 2,
  telemetry: false,
});
