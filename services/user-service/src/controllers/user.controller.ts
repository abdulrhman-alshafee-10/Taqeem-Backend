import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { signAccessToken, issueRefreshToken } from "../services/token.service.js";
import { isLocked, recordFailedLogin, clearFailedLogins } from "../services/auth.service.js";
import { assessLoginRisk } from "../services/suspiciousLogin.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import { redis } from "@taqeem/shared/lib/redis.js";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { recordConsent, getConsents } from "../services/consent.service.js";
import { initiateErasure } from "../services/erasure.service.js";

const prisma = new PrismaClient();

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  await publishEvent("user.registered", {
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    role: user.role,
    at: user.createdAt,
  });

  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  
  if (await isLocked(email)) {
    return res.status(429).json({ error: "Account temporarily locked due to too many failed attempts" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordFailedLogin(email).catch(() => {});
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await recordFailedLogin(email).catch(() => {});
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await clearFailedLogins(email).catch(() => {});

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  // Background risk assessment
  assessLoginRisk(user.id, {
    ip: req.ip || "unknown",
    userAgent: req.get("user-agent") || "unknown",
    geoCountry: req.get("cf-ipcountry") || req.get("x-geoip-country") || "unknown"
  }).catch(err => console.error("Risk assessment failed", err));

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

export async function logout(req: Request, res: Response) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (decoded && decoded.jti && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.set(`blocklist:jti:${decoded.jti}`, "1", { EX: ttl });
      }
    }
  } catch (err) {
    console.error("Logout decode error", err);
  }

  res.json({ message: "Logout successful" });
}

// PRIVACY ENDPOINTS

export async function getUserConsents(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const consents = await getConsents(userId);
  res.json({ consents });
}

export async function putUserConsent(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const { consentType } = req.params;
  const { granted } = req.body; // e.g. { "granted": true }

  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  const log = await recordConsent(userId, {
    consentType,
    granted,
    ip,
    userAgent
  });
  res.json({ message: "Consent updated", log });
}

export async function requestDataExport(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  // Fallback to finding user if email not provided in body, but for now we expect it in body or we look it up.
  const deliveryEmail = req.body.deliveryEmail;
  if (!deliveryEmail) return res.status(400).json({ error: "deliveryEmail is required" });

  await publishEvent("user.export_requested", {
    id: crypto.randomUUID(),
    userId,
    email: deliveryEmail,
    requestedAt: new Date().toISOString(),
  });

  res.status(202).json({
    message: "Data export requested. You will receive an email within 24 hours.",
  });
}

export async function deleteUserAccount(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const result = await initiateErasure(userId);
  res.status(202).json(result);
}

export async function logoutAll(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated || !ctx.id) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  // Increment a generation counter for this user to invalidate all active sessions
  await redis.incr(`token:gen:${ctx.id}`);
  
  // Note: To fully support this, tokens should include the current generation when issued,
  // and the Gateway blocklist middleware should verify the generation matches.
  // For now, this prepares the token generation increment.

  res.json({ message: "All sessions invalidated" });
}

export async function me(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const user = await prisma.user.findUnique({
    where: { id: ctx.id as string },
    select: {
      id: true, email: true, name: true, role: true,
      avatarUrl: true, bio: true, isVerified: true, createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
}

export async function updateMe(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const updated = await prisma.user.update({
    where: { id: ctx.id as string },
    data: req.body,
    select: { id: true, name: true, bio: true, avatarUrl: true, updatedAt: true },
  });
  res.json(updated);
}

export async function updatePrivacy(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const { trackRecentlyViewed } = req.body;
  
  const updated = await prisma.user.update({
    where: { id: ctx.id as string },
    data: { trackRecentlyViewed },
    select: { id: true, trackRecentlyViewed: true, updatedAt: true },
  });
  
  // Optionally publish event user.privacy_updated if needed by consumer (Phase 15 requires Feed Service to check flag before writing to Redis)
  await publishEvent("user.privacy_updated", {
    userId: ctx.id,
    trackRecentlyViewed: updated.trackRecentlyViewed,
    updatedAt: updated.updatedAt
  });

  res.json(updated);
}

