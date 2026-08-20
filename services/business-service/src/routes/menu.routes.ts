import { Router } from "express";
import { 
  getMenu, createMenu, updateMenuMetadata, addSection, 
  addItem, updateItem, reorderMenu, importOcr
} from "../controllers/menu.controller.js";
import { requireBusinessPermission } from "../middleware/permissions.js";

const router = Router();

// Public read
router.get("/businesses/:id/menu", getMenu);

// Owner write
router.post("/owner/businesses/:id/menu", requireBusinessPermission("editProfile"), createMenu);
router.put("/owner/menus/:menuId", requireBusinessPermission("editProfile"), updateMenuMetadata);
router.post("/owner/menus/:menuId/sections", requireBusinessPermission("editProfile"), addSection);
router.post("/owner/sections/:sectionId/items", requireBusinessPermission("editProfile"), addItem);
router.patch("/owner/items/:itemId", requireBusinessPermission("editProfile"), updateItem);
router.put("/owner/menus/:menuId/order", requireBusinessPermission("editProfile"), reorderMenu);
router.post("/owner/menus/:menuId/import-ocr", requireBusinessPermission("editProfile"), importOcr);

export default router;
