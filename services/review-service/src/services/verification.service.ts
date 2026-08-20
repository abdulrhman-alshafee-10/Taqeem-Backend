import axios from "axios";

interface VerificationInput {
  authorId: string;
  businessId: string;
  reservationId?: string;
  orderId?: string;
  checkinId?: string;
}

export async function computeVerification(input: VerificationInput) {
  const { authorId, businessId, reservationId, orderId, checkinId } = input;

  if (reservationId) {
    try {
      const r = await axios.get(
        `http://reservation-service:4009/internal/reservations/${reservationId}`
      ).then(r => r.data);
      if (r?.userId === authorId && r?.businessId === businessId && r?.status === "COMPLETED") {
        return { source: "reservation", refId: reservationId, weight: 2, verifiedAt: new Date() };
      }
    } catch {}
  }

  if (orderId) {
    try {
      const o = await axios.get(
        `http://payment-service:4010/internal/orders/${orderId}`
      ).then(r => r.data);
      if (o?.userId === authorId && o?.businessId === businessId && o?.status === "COMPLETED") {
        return { source: "order", refId: orderId, weight: 2, verifiedAt: new Date() };
      }
    } catch {}
  }

  if (checkinId) {
    try {
      const c = await axios.get(
        `http://content-service:4011/internal/checkins/${checkinId}`
      ).then(r => r.data);
      if (c?.userId === authorId && c?.businessId === businessId &&
          (Date.now() - new Date(c.createdAt).getTime()) < 24 * 3600 * 1000) {
        return { source: "checkin", refId: checkinId, weight: 1, verifiedAt: new Date() };
      }
    } catch {}
  }

  return { source: "none", weight: 0 };
}
