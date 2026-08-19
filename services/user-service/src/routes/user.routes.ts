import { Router } from "express";
import { register, login, me, updateMe } from "../controllers/user.controller.js";
import { validate, RegisterSchema, LoginSchema, UpdateMeSchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/register", validate(RegisterSchema), register);
r.post("/login",    validate(LoginSchema),    login);
r.get ("/me",       requireAuth as any,       me);
r.put ("/me",       requireAuth as any, validate(UpdateMeSchema), updateMe);

export default r;
