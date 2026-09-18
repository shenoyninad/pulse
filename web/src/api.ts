export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
}

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  collectionId: string | null;
}

export interface Scenario {
  id: string;
  requestId: string;
  name: string;
  description: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: string | null;
  bodyMode: "inherit" | "override";
  expectation: string;
}

export interface ExecutionResult {
  id: string;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  durationMs: number;
  executedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCollections: () =>
    fetch("/api/collections").then((r) => json<Collection[]>(r)),

  createCollection: (name: string) =>
    fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Collection>(r)),

  deleteCollection: (id: string) =>
    fetch(`/api/collections/${id}`, { method: "DELETE" }),

  listRequests: () =>
    fetch("/api/requests").then((r) => json<SavedRequest[]>(r)),

  createRequest: (data: Partial<SavedRequest>) =>
    fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<SavedRequest>(r)),

  updateRequest: (id: string, data: Partial<SavedRequest>) =>
    fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<SavedRequest>(r)),

  deleteRequest: (id: string) =>
    fetch(`/api/requests/${id}`, { method: "DELETE" }),

  executeRequest: (id: string) =>
    fetch(`/api/requests/${id}/execute`, { method: "POST" }).then((r) =>
      json<ExecutionResult>(r)
    ),

  listScenarios: (requestId: string) =>
    fetch(`/api/requests/${requestId}/scenarios`).then((r) =>
      json<Scenario[]>(r)
    ),

  generateScenarios: (requestId: string) =>
    fetch(`/api/requests/${requestId}/scenarios/generate`, {
      method: "POST",
    }).then((r) => json<Scenario[]>(r)),

  exportScenarios: (requestId: string, name?: string) =>
    fetch(`/api/requests/${requestId}/scenarios/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Collection>(r)),

  deleteScenario: (id: string) =>
    fetch(`/api/scenarios/${id}`, { method: "DELETE" }),

  executeScenario: (id: string) =>
    fetch(`/api/scenarios/${id}/execute`, { method: "POST" }).then((r) =>
      json<ExecutionResult>(r)
    ),
};
