import { Router } from "express";
import { 
  createGroup, getGroups, attachBusiness, 
  detachBusiness, getGroupAnalytics, inviteMember, acceptInvite
} from "../controllers/group.controller.js";
import { requireBusinessPermission } from "../middleware/permissions.js";

const router = Router();

router.post("/groups", createGroup);
router.get("/groups", getGroups);
router.post("/groups/:id/businesses/:businessId", attachBusiness);
router.delete("/groups/:id/businesses/:businessId", detachBusiness);
router.get("/groups/:id/analytics", getGroupAnalytics);

// Member endpoints for a business
router.post("/businesses/:id/members", requireBusinessPermission("invite"), inviteMember);
router.post("/members/accept", acceptInvite);

export default router;
