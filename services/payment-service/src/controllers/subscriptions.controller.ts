import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-payment";
import { stripe } from "../services/stripe.js";
import axios from "axios";

const prisma = new PrismaClient();

export async function subscriptionCheckout(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { businessId } = req.body;

  try {
    const user = await axios.get(`${process.env.USER_SERVICE_URL}/internal/users/${userId}`);
    
    let customer;
    const existing = await prisma.subscription.findFirst({ where: { userId, businessId } });
    
    if (existing?.stripeCustomerId) {
      customer = existing.stripeCustomerId;
    } else {
      const c = await stripe.customers.create({
        email: user.data.email,
        name: user.data.name,
        metadata: { userId, businessId: businessId ?? "" },
      });
      customer = c.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: process.env.STRIPE_PRICE_OWNER_PRO as string, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL as string,
      cancel_url: process.env.STRIPE_CANCEL_URL as string,
      metadata: { userId, businessId, plan: "OWNER_PRO" },
    });

    if (!existing) {
        await prisma.subscription.create({
            data: {
                userId,
                businessId,
                plan: "OWNER_PRO",
                status: "PENDING",
                stripeCustomerId: customer,
            }
        });
    }

    res.json({ url: session.url });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
  }
}

export async function customerPortal(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sub = await prisma.subscription.findFirst({ where: { userId } });
  if (!sub?.stripeCustomerId) return res.status(404).json({ error: "No subscription" });

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: process.env.STRIPE_SUCCESS_URL as string,
  });

  res.json({ url: session.url });
}
