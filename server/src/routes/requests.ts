import { Router } from "express";
import { prisma } from "../db.js";
import { executeHttp } from "../executor.js";

export const requestsRouter = Router();

requestsRouter.get("/", async (_req, res, next) => {
  try {
    const requests = await prisma.savedRequest.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

requestsRouter.get("/:id", async (req, res, next) => {
  try {
    const request = await prisma.savedRequest.findUnique({
      where: { id: req.params.id },
      include: { executions: { orderBy: { executedAt: "desc" }, take: 20 } },
    });
    if (!request) return res.status(404).json({ error: "not found" });
    res.json(request);
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/", async (req, res, next) => {
  try {
    const { name, method, url, headers, body, collectionId } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: "name and url are required" });
    }
    const request = await prisma.savedRequest.create({
      data: {
        name,
        method: method ?? "GET",
        url,
        headers: headers ?? {},
        body: body ?? null,
        collectionId: collectionId ?? null,
      },
    });
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

requestsRouter.put("/:id", async (req, res, next) => {
  try {
    const { name, method, url, headers, body, collectionId } = req.body;
    const request = await prisma.savedRequest.update({
      where: { id: req.params.id },
      data: { name, method, url, headers, body, collectionId },
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
});

requestsRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.savedRequest.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

requestsRouter.post("/:id/execute", async (req, res, next) => {
  try {
    const saved = await prisma.savedRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!saved) return res.status(404).json({ error: "not found" });

    let outcome;
    try {
      outcome = await executeHttp({
        method: saved.method,
        url: saved.url,
        headers: (saved.headers ?? {}) as Record<string, string>,
        body: saved.body,
      });
    } catch (err) {
      return res.status(502).json({
        error: "request failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    const execution = await prisma.executionResult.create({
      data: {
        requestId: saved.id,
        ...outcome,
      },
    });

    res.json(execution);
  } catch (err) {
    next(err);
  }
});
