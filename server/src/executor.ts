export interface HttpSpec {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface HttpOutcome {
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  durationMs: number;
}

export async function executeHttp(spec: HttpSpec): Promise<HttpOutcome> {
  const hasBody = spec.body != null && !["GET", "HEAD"].includes(spec.method);

  const start = Date.now();
  const response = await fetch(spec.url, {
    method: spec.method,
    headers: spec.headers,
    body: hasBody ? spec.body! : undefined,
  });
  const durationMs = Date.now() - start;

  const responseBody = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return { status: response.status, responseHeaders, responseBody, durationMs };
}
