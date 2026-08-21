import twilio from "twilio";

let client: any;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_SID !== "dummy_sid") {
  client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
}

export async function sendSms(n: any) {
  // Mock internal HTTP
  const user = { phoneE164: `+10000000000` }; 
  if (!user?.phoneE164) throw new Error("No phone on file");

  if (!client) {
    console.log(`[SMS Dummy] Send SMS to ${user.phoneE164}: ${n.subject} - ${n.body}`);
    return `dummy-sms-${Date.now()}`;
  }

  const res = await client.messages.create({
    from: process.env.TWILIO_FROM,
    to: user.phoneE164,
    body: `${n.subject ? n.subject + "\n" : ""}${n.body}`.slice(0, 320),
    statusCallback: `${process.env.PUBLIC_BASE_URL}/webhooks/twilio/status`,
  });
  return `sms:${res.sid}`;
}
