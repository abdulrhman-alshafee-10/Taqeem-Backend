import { Router } from "express";
import { follow, unfollow, getFollowers, getFollowing } from "../controllers/follow.controller.js";

const router = Router();

router.post("/follow", follow);
router.delete("/follow", unfollow);
router.get("/followers/:target/:id", getFollowers);
router.get("/following/:userId", getFollowing);

export default router;
