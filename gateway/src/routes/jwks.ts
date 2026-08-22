import { Router } from "express";
import { createPublicKey } from "crypto";

export const jwksRouter = Router();

// Fallback for backwards compatibility if JWKS_CONFIG isn't set
const getKeys = () => {
  if (process.env.JWKS_CONFIG) {
    return JSON.parse(process.env.JWKS_CONFIG);
  }
  if (process.env.JWT_PUBLIC_KEY) {
    return [{ kid: "default", publicKeyPem: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n") }];
  }
  return [];
};

jwksRouter.get("/.well-known/jwks.json", (req, res) => {
  try {
    const keys = getKeys().map(({ kid, publicKeyPem }: { kid: string, publicKeyPem: string }) => {
      const key = createPublicKey(publicKeyPem);
      const jwk = key.export({ format: "jwk" });
      return { ...jwk, kid, use: "sig", alg: "RS256" };
    });
    res.json({ keys });
  } catch (err) {
    console.error("JWKS generation failed", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
