import { prisma } from "../lib/prisma.js";

interface ConsentInput {
  consentType: string;
  granted: boolean;
  ip: string;
  userAgent: string;
}

export async function recordConsent(userId: string, data: ConsentInput) {
  const version = process.env.PRIVACY_POLICY_VERSION ?? "1.0";
  return prisma.consentLog.create({
    data: {
      userId,
      consentType: data.consentType,
      granted: data.granted,
      ip: data.ip,
      userAgent: data.userAgent,
      version,
    },
  });
}

export async function getConsents(userId: string) {
  // Return the most recent consent per type
  const logs = await prisma.$queryRaw`
    SELECT DISTINCT ON ("consentType") *
    FROM "ConsentLog"
    WHERE "userId" = ${userId}
    ORDER BY "consentType", "at" DESC
  `;
  return logs;
}
