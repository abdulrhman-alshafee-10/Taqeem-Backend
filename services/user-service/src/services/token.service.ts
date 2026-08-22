import jwt from "jsonwebtoken";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// In a real app we'd load this from an env var / secure volume, 
// for local dev without a volume mount yet, we'll try to read it 
// from the root directory where we generated it.
let PRIVATE_KEY = "";
try {
  PRIVATE_KEY = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH || "../../jwt.key", "utf8");
} catch (e) {
  console.warn("Could not read JWT private key, tokens cannot be signed!");
}

const REFRESH_TTL_DAYS = 30;

export function signAccessToken(user: { id: string, role: string, email: string }) {
  if (!PRIVATE_KEY) throw new Error("JWT Private Key not loaded");
  
  const jti = crypto.randomUUID();
  const kid = process.env.JWT_KID || "default";

  return jwt.sign(
    { role: user.role, email: user.email, jti },
    PRIVATE_KEY,
    {
      algorithm: "RS256",
      subject: user.id,
      issuer: "taqeem.user-service",
      audience: "taqeem.api",
      expiresIn: "1h",
      keyid: kid,
    }
  );
}

export async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}
