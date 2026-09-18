import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { collectionsRouter } from "./routes/collections.js";
import { requestsRouter } from "./routes/requests.js";
import {
  requestScenariosRouter,
  scenariosRouter,
} from "./routes/scenarios.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api/health", healthRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/requests/:requestId/scenarios", requestScenariosRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/scenarios", scenariosRouter);

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({
      error: "internal error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`pulse server listening on :${port}`);
});
