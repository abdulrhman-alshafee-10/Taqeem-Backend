import { onReservationReminderDue } from "./reservation.js";

type TranslatorFunc = (payload: any) => Promise<void>;

export const registry: Record<string, TranslatorFunc> = {
  "reservation.reminder_2h": onReservationReminderDue,
  // we will add more mapped events here as needed
};
