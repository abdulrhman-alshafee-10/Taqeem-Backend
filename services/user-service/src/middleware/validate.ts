import { z } from "zod";
import { validate } from "@taqeem/shared/validation/validate.js";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const UpdateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export { validate };
