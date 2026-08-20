import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-order";
import axios from "axios";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function createOrder(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { businessId, items, pickupAt, notes } = req.body;

  try {
    let subtotal = 0;
    const orderItemsData = [];

    // Validate items with business service
    for (const item of items) {
      const bItem = await axios.get(`${process.env.BUSINESS_SERVICE_URL}/internal/businesses/${businessId}/menu/${item.menuItemId}`);
      if (!bItem.data) throw new Error(`Item ${item.menuItemId} not found`);
      
      const price = bItem.data.price;
      subtotal += price * item.quantity;
      
      orderItemsData.push({
        menuItemId: item.menuItemId,
        name: bItem.data.name,
        unitPrice: price,
        quantity: item.quantity,
        notes: item.notes,
      });
    }

    const serviceFee = 5.00; 
    const tax = subtotal * 0.14; 
    const total = subtotal + serviceFee + tax;

    const order = await prisma.order.create({
      data: {
        userId,
        businessId,
        subtotal,
        serviceFee,
        tax,
        total,
        pickupAt: pickupAt ? new Date(pickupAt) : null,
        notes,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    await publishEvent("order.drafted", {
      id: crypto.randomUUID(),
      orderId: order.id,
      userId,
      businessId,
      total,
    });

    res.status(201).json(order);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

export async function getOrder(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  res.json(order);
}

export async function checkoutOrder(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const { id } = req.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status !== "DRAFT") return res.status(400).json({ error: "Already checked out" });

  // Call payment service to create an intent
  try {
    const paymentReq = await axios.post(
      `${process.env.PAYMENT_SERVICE_URL}/api/payments/intents`,
      {
        purpose: "ORDER",
        entity: "order",
        entityId: order.id,
        amount: order.total,
        currency: order.currency,
        metadata: { businessId: order.businessId },
      },
      {
        headers: {
          "x-user-id": userId,
          "Idempotency-Key": `checkout-${order.id}`,
        },
      }
    );

    await prisma.order.update({
      where: { id },
      data: {
        status: "PENDING_PAYMENT",
        paymentId: paymentReq.data.paymentId,
      },
    });

    res.json(paymentReq.data);
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to generate payment intent" });
  }
}

// Simulated webhook for inter-service communication (or RabbitMQ event handler)
export async function webhookHandler(req: Request, res: Response) {
  const { type, data } = req.body;
  if (type === "payment.succeeded" && data.entity === "order") {
    const order = await prisma.order.findUnique({ where: { id: data.entityId } });
    if (order && order.status === "PENDING_PAYMENT") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
      await publishEvent("order.placed", {
        id: crypto.randomUUID(),
        orderId: order.id,
        userId: order.userId,
        businessId: order.businessId,
      });
    }
  }
  res.json({ ok: true });
}
