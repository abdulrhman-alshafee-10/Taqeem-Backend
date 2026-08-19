import express, { Request, Response } from "express";
import businessRoutes from "./routes/business.routes.js";
import ownerRoutes from "./routes/owner.routes.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/businesses", businessRoutes);
app.use("/api/owner",      ownerRoutes);

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`business-service listening on port ${PORT}`);
});
