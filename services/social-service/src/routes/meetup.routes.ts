import { Router } from "express";
import { 
  createMeetup, updateMeetup, cancelMeetup, 
  listMeetups, getMeetupDetails, rsvpToMeetup, removeRsvp 
} from "../controllers/meetup.controller.js";

const router = Router();

router.post("/", createMeetup);
router.patch("/:id", updateMeetup);
router.delete("/:id", cancelMeetup);
router.get("/", listMeetups);
router.get("/:id", getMeetupDetails);
router.post("/:id/rsvp", rsvpToMeetup);
router.delete("/:id/rsvp", removeRsvp);

export default router;
