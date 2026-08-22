import { Router } from "express";
import { register, login, me, updateMe, updatePrivacy } from "../controllers/user.controller.js";
import { validate, RegisterSchema, LoginSchema, UpdateMeSchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/register", validate(RegisterSchema), register);
r.post("/login",    validate(LoginSchema),    login);
import { getPreferences, updatePreferences } from "../controllers/preference.controller.js";

r.get ("/me",       requireAuth as any,       me);
r.put ("/me",       requireAuth as any, validate(UpdateMeSchema), updateMe);

r.patch("/me/privacy", requireAuth as any, updatePrivacy);
r.get("/me/preferences", requireAuth as any, getPreferences);
r.put("/me/preferences", requireAuth as any, updatePreferences);

export default r;
