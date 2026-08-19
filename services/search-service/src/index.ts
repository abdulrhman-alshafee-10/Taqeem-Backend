import express, { Request, Response } from "express";
import searchRoutes from "./routes/search.routes.js";

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`search-service listening on port ${PORT}`);
});
