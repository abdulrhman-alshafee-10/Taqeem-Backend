import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { signAccessToken, issueRefreshToken } from "../services/token.service.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

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
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
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
