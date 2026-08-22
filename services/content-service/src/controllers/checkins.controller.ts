import { Request, Response } from "express";
import { Checkin } from "../models/checkin.model.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { redis } from "../redis.js";
import axios from "axios";

// Haversine distance in meters
function haversineMeters(p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const lat1 = p1.lat * rad, lat2 = p2.lat * rad;
  const dLat = (p2.lat - p1.lat) * rad;
  const dLng = (p2.lng - p1.lng) * rad;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function createCheckin(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { businessId, lat, lng, reservationId, orderId } = req.body;
    
    let distance = 0;
    const method = reservationId ? "reservation" : orderId ? "order" : "gps";

    if (method === "gps") {
      if (lat === undefined || lng === undefined) return res.status(400).json({ error: "Missing coordinates" });
      try {
        const bizRes = await axios.get(`${process.env.BUSINESS_SERVICE_URL || 'http://business-service:4002'}/api/businesses/${businessId}`);
        const biz = bizRes.data;
        if (!biz || !biz.location) return res.status(404).json({ error: "Business not found" });
        
        distance = haversineMeters({ lat, lng }, { lat: biz.location.lat, lng: biz.location.lng });
        if (distance > 200) {
          return res.status(400).json({ error: "Too far from business", distance });
        }
      } catch (e) {
        return res.status(404).json({ error: "Business error" });
      }
    }

    const rateKey = `checkin:${userId}:${businessId}:${Math.floor(Date.now()/3600000)}`;
    const first = await redis.set(rateKey, "1", { NX: true, EX: 3600 });
    if (!first) return res.status(429).json({ error: "Already checked in this hour" });

    const doc = await Checkin.create({
      businessId, userId, location: { lat, lng }, distanceMeters: distance, method,
    });
    
    await publishEvent("checkin.created", {
      id: crypto.randomUUID(),
      checkinId: doc._id.toString(), userId, businessId, method,
      at: doc.createdAt.toISOString(),
    });
    
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listCheckins(req: Request, res: Response) {
  try {
    const { id: businessId } = req.params;
    const checkins = await Checkin.find({ businessId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ items: checkins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
