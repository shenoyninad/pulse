import { useEffect, useState } from "react";
import {
  api,
  Collection,
  SavedRequest,
  ExecutionResult,
  Scenario,
} from "./api";
import { parseCurl } from "./curl";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

interface HeaderRow {
  key: string;
  value: string;
}

export default function App() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uncategorized, setUncategorized] = useState<SavedRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("Untitled request");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [body, setBody] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");

  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioResults, setScenarioResults] = useState<
    Record<string, ExecutionResult | { error: string }>
  >({});
  const [generating, setGenerating] = useState(false);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedTo, setExportedTo] = useState<string | null>(null);

  const [curlText, setCurlText] = useState("");
  const [curlError, setCurlError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  async function refresh() {
    const [cols, reqs] = await Promise.all([
      api.listCollections(),
      api.listRequests(),
    ]);
    setCollections(cols);
    setUncategorized(reqs.filter((r) => !r.collectionId));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  function loadRequest(req: SavedRequest) {
    setSelectedId(req.id);
    setName(req.name);
    setMethod(req.method);
    setUrl(req.url);
    setBody(req.body ?? "");
    setCollectionId(req.collectionId ?? "");
    setHeaderRows(
      Object.entries(req.headers ?? {}).map(([key, value]) => ({ key, value }))
    );
    setResult(null);
    setError(null);
    setScenarioResults({});
    setExportedTo(null);
    api
      .listScenarios(req.id)
      .then(setScenarios)
      .catch(() => setScenarios([]));
  }

  function newRequest() {
    setSelectedId(null);
    setName("Untitled request");
    setMethod("GET");
    setUrl("");
    setBody("");
    setCollectionId("");
    setHeaderRows([]);
    setResult(null);
    setError(null);
    setScenarios([]);
    setScenarioResults({});
    setExportedTo(null);
  }

  function headersObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of headerRows) {
      if (row.key.trim()) out[row.key.trim()] = row.value;
    }
    return out;
  }

  async function save(): Promise<string | null> {
    setError(null);
    try {
      const data = {
        name,
        method,
        url,
        headers: headersObject(),
        body: body || null,
        collectionId: collectionId || null,
      };
      let id = selectedId;
      if (id) {
        await api.updateRequest(id, data);
      } else {
        const created = await api.createRequest(data);
        id = created.id;
        setSelectedId(id);
      }
      await refresh();
      return id;
    } catch (e) {
      setError(String(e));
      return null;
    }
  }

  async function send() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const id = await save();
      if (!id) return;
      const execution = await api.executeRequest(id);
      setResult(execution);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function importCurl() {
    setCurlError(null);
    try {
      const parsed = parseCurl(curlText);
      setSelectedId(null);
      setName(`${parsed.method} ${new URL(parsed.url).pathname}` || "Imported request");
      setMethod(parsed.method);
      setUrl(parsed.url);
      setBody(parsed.body ?? "");
      setHeaderRows(
        Object.entries(parsed.headers).map(([key, value]) => ({ key, value }))
      );
      setCollectionId("");
      setScenarios([]);
      setScenarioResults({});
      setResult(null);
      setError(null);
      setCurlText("");
      setExportedTo(null);
    } catch (e) {
      setCurlError(e instanceof Error ? e.message : String(e));
    }
  }

  async function exportScenariosToCollection() {
    if (!selectedId) return;
    setExporting(true);
    setError(null);
    try {
      const collection = await api.exportScenarios(selectedId);
      setExportedTo(collection.name);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const id = await save();
      if (!id) return;
      const generated = await api.generateScenarios(id);
      setScenarios(generated);
      setScenarioResults({});
      setExportedTo(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function runScenario(id: string) {
    setRunningScenario(id);
    try {
      const execution = await api.executeScenario(id);
      setScenarioResults((prev) => ({ ...prev, [id]: execution }));
    } catch (e) {
      setScenarioResults((prev) => ({ ...prev, [id]: { error: String(e) } }));
    } finally {
      setRunningScenario(null);
    }
  }

  async function removeScenario(id: string) {
    await api.deleteScenario(id);
    setScenarios(scenarios.filter((s) => s.id !== id));
  }

  async function addCollection() {
    const collectionName = prompt("Collection name?");
    if (!collectionName) return;
    await api.createCollection(collectionName);
    await refresh();
  }

  async function removeCollection(col: Collection) {
    if (confirmingDelete !== col.id) {
      setConfirmingDelete(col.id);
      return;
    }
    setConfirmingDelete(null);
    await api.deleteCollection(col.id);
    if (selectedId && col.requests.some((r) => r.id === selectedId)) {
      newRequest();
    }
    await refresh();
  }

  async function removeRequest(id: string) {
    await api.deleteRequest(id);
    if (selectedId === id) newRequest();
    await refresh();
  }

  function prettyBody(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Pulse</h1>
          <div>
            <button onClick={newRequest}>+ Request</button>
            <button onClick={addCollection}>+ Collection</button>
          </div>
        </div>

        {collections.map((col) => (
          <div key={col.id} className="collection">
            <div className="collection-header">
              <div className="collection-name">{col.name}</div>
              <button
                className={
                  confirmingDelete === col.id ? "delete confirming" : "delete"
                }
                onClick={() => removeCollection(col)}
                onBlur={() => setConfirmingDelete(null)}
                title="Delete collection and all its requests"
              >
                {confirmingDelete === col.id ? "Delete all?" : "✕"}
              </button>
            </div>
            {col.requests.length === 0 && (
              <div className="collection-empty">Empty</div>
            )}
            {col.requests.map((req) => (
              <RequestItem
                key={req.id}
                req={req}
                active={req.id === selectedId}
                onSelect={() => loadRequest(req)}
                onDelete={() => removeRequest(req.id)}
              />
            ))}
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div className="collection">
            <div className="collection-name">Uncategorized</div>
            {uncategorized.map((req) => (
              <RequestItem
                key={req.id}
                req={req}
                active={req.id === selectedId}
                onSelect={() => loadRequest(req)}
                onDelete={() => removeRequest(req.id)}
              />
            ))}
          </div>
        )}
      </aside>

      <main className="main">
        <details className="curl-import">
          <summary>Import from cURL</summary>
          <textarea
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            rows={4}
            placeholder={"curl -X POST https://api.example.com/users \\\n  -H 'Authorization: Bearer …' \\\n  -d '{\"name\":\"Ada\"}'"}
          />
          <div className="row">
            <button onClick={importCurl} disabled={!curlText.trim()}>
              Import
            </button>
            {curlError && <span className="inline-error">{curlError}</span>}
          </div>
        </details>

        <div className="row">
          <input
            className="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Request name"
          />
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            className="url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
          />
          <button onClick={save} disabled={busy}>
            Save
          </button>
          <button className="primary" onClick={send} disabled={busy || !url}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>

        <section>
          <h2>Headers</h2>
          {headerRows.map((row, i) => (
            <div className="row" key={i}>
              <input
                value={row.key}
                placeholder="Header"
                onChange={(e) => {
                  const next = [...headerRows];
                  next[i] = { ...row, key: e.target.value };
                  setHeaderRows(next);
                }}
              />
              <input
                value={row.value}
                placeholder="Value"
                onChange={(e) => {
                  const next = [...headerRows];
                  next[i] = { ...row, value: e.target.value };
                  setHeaderRows(next);
                }}
              />
              <button
                onClick={() =>
                  setHeaderRows(headerRows.filter((_, j) => j !== i))
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => setHeaderRows([...headerRows, { key: "", value: "" }])}
          >
            + Header
          </button>
        </section>

        <section>
          <h2>Body</h2>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder='{"example": true}'
          />
        </section>

        <section>
          <div className="section-header">
            <h2>Scenarios</h2>
            <div className="section-actions">
              {exportedTo && (
                <span className="exported-note">Exported to “{exportedTo}”</span>
              )}
              {scenarios.length > 0 && (
                <button
                  onClick={exportScenariosToCollection}
                  disabled={exporting}
                >
                  {exporting ? "Exporting…" : "Export to collection"}
                </button>
              )}
              <button onClick={generate} disabled={generating || !url}>
                {generating ? "Generating…" : "Generate scenarios"}
              </button>
            </div>
          </div>
          {scenarios.length === 0 && (
            <p className="muted">
              Generate edge-case variations of this request — empty and boundary
              params, missing auth, wrong content types, malformed bodies — then
              run each one individually.
            </p>
          )}
          {scenarios.map((s) => (
            <ScenarioRow
              key={s.id}
              scenario={s}
              result={scenarioResults[s.id]}
              running={runningScenario === s.id}
              onRun={() => runScenario(s.id)}
              onDelete={() => removeScenario(s.id)}
              prettyBody={prettyBody}
            />
          ))}
        </section>

        <section>
          <h2>Response</h2>
          {error && <pre className="error">{error}</pre>}
          {result && (
            <div>
              <div className="response-meta">
                <span
                  className={
                    result.status < 400 ? "status ok" : "status bad"
                  }
                >
                  {result.status}
                </span>
                <span>{result.durationMs} ms</span>
              </div>
              <details>
                <summary>Headers</summary>
                <pre>{JSON.stringify(result.responseHeaders, null, 2)}</pre>
              </details>
              <pre className="response-body">
                {prettyBody(result.responseBody)}
              </pre>
            </div>
          )}
          {!result && !error && <p className="muted">Send a request to see the response.</p>}
        </section>
      </main>
    </div>
  );
}

function ScenarioRow({
  scenario,
  result,
  running,
  onRun,
  onDelete,
  prettyBody,
}: {
  scenario: Scenario;
  result?: ExecutionResult | { error: string };
  running: boolean;
  onRun: () => void;
  onDelete: () => void;
  prettyBody: (text: string) => string;
}) {
  const execution = result && "status" in result ? result : null;
  const failure = result && "error" in result ? result : null;

  return (
    <div className="scenario">
      <div className="scenario-row">
        <div className="scenario-info">
          <div className="scenario-name">{scenario.name}</div>
          <div className="scenario-desc">{scenario.description}</div>
          {scenario.expectation && (
            <div className="scenario-expect">{scenario.expectation}</div>
          )}
        </div>
        <div className="scenario-actions">
          {execution && (
            <span
              className={execution.status < 400 ? "status ok" : "status bad"}
            >
              {execution.status}
            </span>
          )}
          {execution && <span className="muted">{execution.durationMs} ms</span>}
          <button onClick={onRun} disabled={running}>
            {running ? "Running…" : "Run"}
          </button>
          <button className="delete" onClick={onDelete} title="Delete">
            ✕
          </button>
        </div>
      </div>

      <details className="scenario-details">
        <summary>What this sends</summary>
        <pre>
          {JSON.stringify(
            {
              url: scenario.url ?? "(inherited)",
              headers: scenario.headers ?? "(inherited)",
              body:
                scenario.bodyMode === "override"
                  ? scenario.body ?? "(no body)"
                  : "(inherited)",
            },
            null,
            2
          )}
        </pre>
      </details>

      {failure && <pre className="error">{failure.error}</pre>}
      {execution && (
        <details className="scenario-details">
          <summary>Response body</summary>
          <pre>{prettyBody(execution.responseBody)}</pre>
        </details>
      )}
    </div>
  );
}

function RequestItem({
  req,
  active,
  onSelect,
  onDelete,
}: {
  req: SavedRequest;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={active ? "request-item active" : "request-item"}>
      <button className="request-link" onClick={onSelect}>
        <span className={`method method-${req.method.toLowerCase()}`}>
          {req.method}
        </span>
        {req.name}
      </button>
      <button className="delete" onClick={onDelete} title="Delete">
        ✕
      </button>
    </div>
  );
}
