import { Router } from "express";
import { search } from "../controllers/search.controller.js";

const r = Router();
r.get("/", search);
export default r;
