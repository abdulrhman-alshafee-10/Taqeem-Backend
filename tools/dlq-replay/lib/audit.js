import { appendFileSync } from "fs";

export function writeAuditLog(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + "\n";
  appendFileSync(process.env.AUDIT_LOG_PATH ?? "./audit.log", line);
}
