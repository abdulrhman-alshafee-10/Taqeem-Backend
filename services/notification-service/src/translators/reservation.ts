import { plan, dispatch } from "../pipeline.js";

export async function onReservationReminderDue(payload: any) {
  const notifs = await plan({
    userId: payload.userId,
    type: "reservation.reminder_2h",
    channels: ["PUSH", "EMAIL", "INAPP"],
    subject: "Your reservation is in 2 hours",
    body: `Your booking at ${payload.businessName} is at ${payload.startsAt}.`,
    data: { 
      reservationId: payload.reservationId, 
      businessId: payload.businessId, 
      deepLink: `/reservations/${payload.reservationId}` 
    },
    dedupeKey: `res-remind-${payload.reservationId}-2h`,
  });
  
  await Promise.all(notifs.map(dispatch));
}
