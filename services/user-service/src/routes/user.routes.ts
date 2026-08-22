import { Router } from "express";
import { 
  register, 
  login, 
  logout, 
  logoutAll, 
  me, 
  updateMe, 
  updatePrivacy,
  getUserConsents,
  putUserConsent,
  requestDataExport,
  deleteUserAccount
} from "../controllers/user.controller.js";
import { validate, RegisterSchema, LoginSchema, UpdateMeSchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";
import { getPreferences, updatePreferences } from "../controllers/preference.controller.js";

const r = Router();

r.post("/register", validate(RegisterSchema), register);
r.post("/login",    validate(LoginSchema),    login);
r.post("/logout",   requireAuth as any,       logout);
r.post("/logout-all", requireAuth as any,     logoutAll);

r.get ("/me",       requireAuth as any,       me);
r.put ("/me",       requireAuth as any, validate(UpdateMeSchema), updateMe);

r.patch("/me/privacy", requireAuth as any, updatePrivacy);
r.get("/me/preferences", requireAuth as any, getPreferences);
r.put("/me/preferences", requireAuth as any, updatePreferences);

// Privacy endpoints
r.get("/privacy/consents", requireAuth as any, getUserConsents);
r.put("/privacy/consents/:consentType", requireAuth as any, putUserConsent);
r.post("/privacy/export", requireAuth as any, requestDataExport);
r.delete("/privacy/delete", requireAuth as any, deleteUserAccount);

export default r;
