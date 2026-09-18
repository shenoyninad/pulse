// Rule-based edge-case scenario generation. Given a saved request, emit a
// bounded set of variations over its query parameters, headers, and JSON body.
// Overrides are full replacements: url/headers/body null means "inherit".

export interface ScenarioDraft {
  name: string;
  description: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: string | null;
  bodyMode: "inherit" | "override";
  expectation: string;
}

const MAX_SCENARIOS = 24;
const MAX_PARAMS_VARIED = 5;
const MAX_BODY_FIELDS_VARIED = 5;
const LONG_STRING = "A".repeat(1024);
const SPECIAL_CHARS = "'\";<>&%00é漢😀";

interface BaseRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

export function generateScenarios(base: BaseRequest): ScenarioDraft[] {
  const drafts: ScenarioDraft[] = [];

  addQueryParamScenarios(base, drafts);
  addHeaderScenarios(base, drafts);
  addBodyScenarios(base, drafts);

  return drafts.slice(0, MAX_SCENARIOS);
}

function withParams(url: URL, mutate: (params: URLSearchParams) => void): string {
  const next = new URL(url.toString());
  mutate(next.searchParams);
  return next.toString();
}

function addQueryParamScenarios(base: BaseRequest, drafts: ScenarioDraft[]) {
  let url: URL;
  try {
    url = new URL(base.url);
  } catch {
    return;
  }

  const params = [...url.searchParams.entries()].slice(0, MAX_PARAMS_VARIED);

  for (const [key, value] of params) {
    drafts.push({
      name: `Empty "${key}" param`,
      description: `Query parameter "${key}" sent with an empty value.`,
      url: withParams(url, (p) => p.set(key, "")),
      headers: null,
      body: null,
      bodyMode: "inherit",
      expectation: "Should validate and reject or apply a sane default.",
    });

    drafts.push({
      name: `Missing "${key}" param`,
      description: `Query parameter "${key}" omitted entirely.`,
      url: withParams(url, (p) => p.delete(key)),
      headers: null,
      body: null,
      bodyMode: "inherit",
      expectation: "Should 4xx if required, or handle absence gracefully.",
    });

    drafts.push({
      name: `Long "${key}" param`,
      description: `Query parameter "${key}" set to a 1KB string.`,
      url: withParams(url, (p) => p.set(key, LONG_STRING)),
      headers: null,
      body: null,
      bodyMode: "inherit",
      expectation: "Should enforce length limits without a 5xx.",
    });

    drafts.push({
      name: `Special chars in "${key}"`,
      description: `Query parameter "${key}" set to quotes, angle brackets, and unicode.`,
      url: withParams(url, (p) => p.set(key, SPECIAL_CHARS)),
      headers: null,
      body: null,
      bodyMode: "inherit",
      expectation: "Should escape/validate input, never 5xx.",
    });

    if (value !== "" && Number.isFinite(Number(value))) {
      for (const boundary of ["0", "-1", "99999999999999"]) {
        drafts.push({
          name: `"${key}" = ${boundary}`,
          description: `Numeric query parameter "${key}" at boundary value ${boundary}.`,
          url: withParams(url, (p) => p.set(key, boundary)),
          headers: null,
          body: null,
          bodyMode: "inherit",
          expectation: "Should range-check numeric input.",
        });
      }
    }
  }
}

const AUTH_HEADER_NAMES = ["authorization", "x-api-key", "api-key", "x-auth-token"];

function addHeaderScenarios(base: BaseRequest, drafts: ScenarioDraft[]) {
  const headers = base.headers ?? {};
  const authKey = Object.keys(headers).find((k) =>
    AUTH_HEADER_NAMES.includes(k.toLowerCase())
  );

  if (authKey) {
    const withoutAuth = { ...headers };
    delete withoutAuth[authKey];
    drafts.push({
      name: "Missing auth header",
      description: `Request sent without the "${authKey}" header.`,
      url: null,
      headers: withoutAuth,
      body: null,
      bodyMode: "inherit",
      expectation: "Should return 401.",
    });

    drafts.push({
      name: "Invalid auth credentials",
      description: `"${authKey}" header replaced with a garbage token.`,
      url: null,
      headers: { ...headers, [authKey]: "Bearer invalid-token-000" },
      body: null,
      bodyMode: "inherit",
      expectation: "Should return 401/403, not 5xx.",
    });
  }

  const contentTypeKey = Object.keys(headers).find(
    (k) => k.toLowerCase() === "content-type"
  );
  const sendsJson =
    contentTypeKey && headers[contentTypeKey].includes("json");
  if (sendsJson && base.body) {
    drafts.push({
      name: "Wrong content type",
      description: "JSON body sent with Content-Type: text/plain.",
      url: null,
      headers: { ...headers, [contentTypeKey!]: "text/plain" },
      body: null,
      bodyMode: "inherit",
      expectation: "Should return 415 or 400.",
    });
  }

  drafts.push({
    name: "Unexpected Accept header",
    description: "Accept header demands XML.",
    url: null,
    headers: { ...headers, Accept: "application/xml" },
    body: null,
    bodyMode: "inherit",
    expectation: "Should negotiate content or return 406.",
  });
}

function addBodyScenarios(base: BaseRequest, drafts: ScenarioDraft[]) {
  if (!base.body || ["GET", "HEAD"].includes(base.method)) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(base.body);
  } catch {
    return;
  }

  drafts.push({
    name: "Empty body",
    description: "Request sent with no body at all.",
    url: null,
    headers: null,
    body: null,
    bodyMode: "override",
    expectation: "Should return 400 for a required body.",
  });

  drafts.push({
    name: "Malformed JSON body",
    description: "Body is truncated, invalid JSON.",
    url: null,
    headers: null,
    body: base.body.slice(0, Math.max(1, base.body.length - 2)),
    bodyMode: "override",
    expectation: "Should return 400, not 5xx.",
  });

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;

    drafts.push({
      name: "Empty JSON object",
      description: "Body is {} — every field missing.",
      url: null,
      headers: null,
      body: "{}",
      bodyMode: "override",
      expectation: "Should report which required fields are missing.",
    });

    const fields = Object.entries(record).slice(0, MAX_BODY_FIELDS_VARIED);
    for (const [key, value] of fields) {
      drafts.push({
        name: `Null "${key}" field`,
        description: `Body field "${key}" set to null.`,
        url: null,
        headers: null,
        body: JSON.stringify({ ...record, [key]: null }),
        bodyMode: "override",
        expectation: "Should validate nullability.",
      });

      const wrongType =
        typeof value === "number" ? "not-a-number" : typeof value === "string" ? 12345 : "wrong";
      drafts.push({
        name: `Wrong type for "${key}"`,
        description: `Body field "${key}" (${typeof value}) replaced with ${JSON.stringify(wrongType)}.`,
        url: null,
        headers: null,
        body: JSON.stringify({ ...record, [key]: wrongType }),
        bodyMode: "override",
        expectation: "Should return 400 with a type error.",
      });

      if (typeof value === "string") {
        drafts.push({
          name: `Long "${key}" field`,
          description: `Body field "${key}" set to a 1KB string.`,
          url: null,
          headers: null,
          body: JSON.stringify({ ...record, [key]: LONG_STRING }),
          bodyMode: "override",
          expectation: "Should enforce length limits.",
        });
      }

      if (typeof value === "number") {
        drafts.push({
          name: `Negative "${key}" field`,
          description: `Numeric body field "${key}" set to -1.`,
          url: null,
          headers: null,
          body: JSON.stringify({ ...record, [key]: -1 }),
          bodyMode: "override",
          expectation: "Should range-check numeric input.",
        });
      }
    }
  }
}
