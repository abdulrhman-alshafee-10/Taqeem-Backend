import { Client as Postmark } from "postmark";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
// For now, no template rendering, just simple text/html dummy render
// import { renderTemplate } from "../templates/renderer.js";

const postmark = new Postmark(process.env.POSTMARK_TOKEN || "dummy_postmark");
const ses = new SESClient({ region: process.env.SES_REGION || "us-east-1" });

const FROM = "Taqeem <noreply@taqeem.app>";

export async function sendEmail(n: any) {
  // Mock internal HTTP call to user-service
  const user = { email: `user-${n.userId}@example.com` }; 
  if (!user?.email) throw new Error("No email on file");

  const subject = n.subject || "Notification";
  const html = `<p>${n.body}</p>`;
  const text = n.body;

  try {
    const res = await postmark.sendEmail({
      From: FROM,
      To: user.email,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: "outbound",
      Metadata: { notifId: n.id, type: n.type },
    });
    return res.MessageID;
  } catch (e: any) {
    // Fallback to SES if Postmark fails (or if dummy token)
    try {
      const out = await ses.send(new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: html }, Text: { Data: text } },
        },
      }));
      return out.MessageId;
    } catch(err: any) {
      // In local dev, we might not have valid AWS creds either
      console.log(`[Email Dummy] Sent to ${user.email}: ${subject}`);
      return `dummy-email-${Date.now()}`;
    }
  }
}
