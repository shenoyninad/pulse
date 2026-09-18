import { Router } from "express";
import { prisma } from "../db.js";

export const collectionsRouter = Router();

collectionsRouter.get("/", async (_req, res, next) => {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { createdAt: "asc" },
      include: { requests: { orderBy: { createdAt: "asc" } } },
    });
    res.json(collections);
  } catch (err) {
    next(err);
  }
});

collectionsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    const collection = await prisma.collection.create({ data: { name } });
    res.status(201).json(collection);
  } catch (err) {
    next(err);
  }
});

collectionsRouter.put("/:id", async (req, res, next) => {
  try {
    const { name } = req.body;
    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(collection);
  } catch (err) {
    next(err);
  }
});

collectionsRouter.delete("/:id", async (req, res, next) => {
  try {
    // Clearing a collection removes its requests too, not just the grouping.
    await prisma.$transaction([
      prisma.savedRequest.deleteMany({ where: { collectionId: req.params.id } }),
      prisma.collection.delete({ where: { id: req.params.id } }),
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
