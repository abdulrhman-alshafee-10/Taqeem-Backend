import { Router } from "express";
import { search } from "../controllers/search.controller.js";
import { map } from "../controllers/map.controller.js";
import { trending, hiddenGems } from "../controllers/trending.controller.js";

import { nlSearch } from "../controllers/nl-search.controller.js";

const r = Router();
r.get("/", search);
r.get("/nl", nlSearch);
r.get("/map", map);
r.get("/trending", trending);
r.get("/hidden-gems", hiddenGems);
export default r;
