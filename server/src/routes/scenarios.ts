import { Router } from "express";
import { prisma } from "../db.js";
import { executeHttp } from "../executor.js";
import { generateScenarios } from "../scenarios/generate.js";

// Mounted at /api/requests/:requestId/scenarios
export const requestScenariosRouter = Router({ mergeParams: true });

requestScenariosRouter.get("/", async (req, res, next) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      where: { requestId: req.params.requestId },
      orderBy: { createdAt: "asc" },
    });
    res.json(scenarios);
  } catch (err) {
    next(err);
  }
});

requestScenariosRouter.post("/generate", async (req, res, next) => {
  try {
    const saved = await prisma.savedRequest.findUnique({
      where: { id: req.params.requestId },
    });
    if (!saved) return res.status(404).json({ error: "request not found" });

    const drafts = generateScenarios({
      method: saved.method,
      url: saved.url,
      headers: (saved.headers ?? {}) as Record<string, string>,
      body: saved.body,
    });

    // Regenerating replaces previous generated set for a clean slate.
    await prisma.scenario.deleteMany({ where: { requestId: saved.id } });
    await prisma.scenario.createMany({
      data: drafts.map((d) => ({
        requestId: saved.id,
        name: d.name,
        description: d.description,
        url: d.url,
        headers: d.headers ?? undefined,
        body: d.body,
        bodyMode: d.bodyMode,
        expectation: d.expectation,
      })),
    });

    const scenarios = await prisma.scenario.findMany({
      where: { requestId: saved.id },
      orderBy: { createdAt: "asc" },
    });
    res.status(201).json(scenarios);
  } catch (err) {
    next(err);
  }
});

requestScenariosRouter.post("/export", async (req, res, next) => {
  try {
    const saved = await prisma.savedRequest.findUnique({
      where: { id: req.params.requestId },
      include: { scenarios: { orderBy: { createdAt: "asc" } } },
    });
    if (!saved) return res.status(404).json({ error: "request not found" });
    if (saved.scenarios.length === 0) {
      return res.status(400).json({ error: "no scenarios to export" });
    }

    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : `${saved.name} scenarios`;

    const collection = await prisma.collection.create({ data: { name } });

    // Each scenario becomes a standalone saved request with its
    // inherited values resolved against the base request.
    await prisma.savedRequest.createMany({
      data: saved.scenarios.map((s) => ({
        name: s.name,
        method: saved.method,
        url: s.url ?? saved.url,
        headers: (s.headers ?? saved.headers ?? {}) as object,
        body: s.bodyMode === "override" ? s.body : saved.body,
        collectionId: collection.id,
      })),
    });

    const result = await prisma.collection.findUnique({
      where: { id: collection.id },
      include: { requests: { orderBy: { createdAt: "asc" } } },
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Mounted at /api/scenarios
export const scenariosRouter = Router();

scenariosRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.scenario.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

scenariosRouter.post("/:id/execute", async (req, res, next) => {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: req.params.id },
      include: { request: true },
    });
    if (!scenario) return res.status(404).json({ error: "not found" });

    const base = scenario.request;
    const spec = {
      method: base.method,
      url: scenario.url ?? base.url,
      headers: (scenario.headers ?? base.headers ?? {}) as Record<string, string>,
      body: scenario.bodyMode === "override" ? scenario.body : base.body,
    };

    let outcome;
    try {
      outcome = await executeHttp(spec);
    } catch (err) {
      return res.status(502).json({
        error: "request failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    const execution = await prisma.executionResult.create({
      data: {
        requestId: base.id,
        scenarioId: scenario.id,
        ...outcome,
      },
    });

    res.json(execution);
  } catch (err) {
    next(err);
  }
});
