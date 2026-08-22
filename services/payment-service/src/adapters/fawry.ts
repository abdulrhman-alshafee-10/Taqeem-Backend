import axios from "axios";
import crypto from "node:crypto";

const BASE = process.env.FAWRY_BASE_URL || "https://atfawry.com";
const MERCHANT = process.env.FAWRY_MERCHANT_CODE || "TEST_MERCHANT";
const SECURE = process.env.FAWRY_SECURE_KEY || "TEST_SECURE_KEY";

function sig(fields: string[]) {
  return crypto.createHash("sha256").update(fields.join("") + SECURE).digest("hex");
}

export const fawryAdapter = {
  async createIntent({ paymentId, amount, currency, userId, buyer }: any) {
    const merchantRefNum = paymentId;
    const signature = sig([MERCHANT, merchantRefNum, buyer?.email || "", "PAYATFAWRY", amount.toFixed(2)]);
    
    // In local dev without a real Fawry integration, we mock the response
    if (process.env.NODE_ENV === "development" && MERCHANT === "TEST_MERCHANT") {
      return {
        providerRef: "999999999",
        payload: {
          expirationHours: 48,
          instructionsEn: `Pay ${amount} ${currency} at any Fawry outlet using code 999999999`,
          instructionsAr: `ادفع ${amount} ${currency} في أقرب فرع فوري باستخدام الرمز 999999999`,
        },
      };
    }

    const res = await axios.post(`${BASE}/ECommerceWeb/Fawry/payments/charge`, {
      merchantCode: MERCHANT,
      merchantRefNum,
      customerName:  buyer?.name || "Unknown",
      customerMobile: buyer?.phoneE164 || "",
      customerEmail:  buyer?.email || "",
      customerProfileId: userId,
      paymentMethod: "PAYATFAWRY",
      amount, currency,
      chargeItems: [{ itemId: paymentId, description: "Taqeem", price: amount, quantity: 1 }],
      description: "Taqeem payment",
      signature,
    }, { timeout: 8000 });

    return {
      providerRef: res.data.referenceNumber,
      payload: {
        expirationHours: 48,
        instructionsEn: `Pay ${amount} ${currency} at any Fawry outlet using code ${res.data.referenceNumber}`,
        instructionsAr: `ادفع ${amount} ${currency} في أقرب فرع فوري باستخدام الرمز ${res.data.referenceNumber}`,
      },
    };
  },

  async handleWebhook(event: any) {
    const expected = sig([MERCHANT, event.merchantRefNumber, parseFloat(event.paymentAmount).toFixed(2), event.orderStatus]);
    if (expected !== event.messageSignature) throw new Error("Bad signature");
    const status = event.orderStatus === "PAID" ? "SUCCEEDED" : event.orderStatus === "EXPIRED" ? "CANCELLED" : "REQUIRES_ACTION";
    return { status, paymentId: event.merchantRefNumber };
  },
};
