import { Router } from "express";
import { createDeal, updateDeal, deleteDeal, listDeals } from "../controllers/deal.controller.js";
import { requireBusinessPermission } from "../middleware/permissions.js";

const r = Router({ mergeParams: true }); // mounts on /api/businesses/:businessId/deals

r.get("/", listDeals);
r.post("/", requireBusinessPermission("MANAGER") as any, createDeal);
r.patch("/:dealId", requireBusinessPermission("MANAGER") as any, updateDeal);
r.delete("/:dealId", requireBusinessPermission("MANAGER") as any, deleteDeal);

export default r;
