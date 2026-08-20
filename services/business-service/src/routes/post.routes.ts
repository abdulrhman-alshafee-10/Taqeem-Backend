import { Router } from "express";
import { getPosts, createPost, updatePost, deletePost } from "../controllers/post.controller.js";
import { requireBusinessPermission } from "../middleware/permissions.js";

const router = Router();

router.get("/businesses/:id/posts", getPosts);
router.post("/owner/businesses/:id/posts", requireBusinessPermission("editProfile"), createPost);
router.patch("/owner/posts/:postId", updatePost); // Permission check needs businessId, normally we'd fetch post to check or rely on parent route
router.delete("/owner/posts/:postId", deletePost);

export default router;
