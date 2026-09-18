// Parse a pasted curl command into request-builder fields.

export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

// Shell-like tokenizer: handles single/double quotes and backslash
// escapes, and joins backslash-newline line continuations.
function tokenize(input: string): string[] {
  const src = input.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < src.length && '"\\$`'.includes(src[i + 1])) {
        current += src[++i];
      } else if (ch === '"') {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch as '"' | "'";
      inToken = true;
    } else if (ch === "\\" && i + 1 < src.length) {
      current += src[++i];
      inToken = true;
    } else if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = "";
        inToken = false;
      }
    } else {
      current += ch;
      inToken = true;
    }
  }
  if (inToken) tokens.push(current);
  return tokens;
}

// Flags whose value we consume but ignore.
const IGNORED_WITH_ARG = new Set([
  "-o", "--output", "-w", "--write-out", "-m", "--max-time",
  "--connect-timeout", "--retry", "-x", "--proxy", "--cacert",
  "-c", "--cookie-jar", "-F", "--form", "--limit-rate",
]);

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0 || !/^curl(\.exe)?$/i.test(tokens[0])) {
    throw new Error("Not a curl command — it should start with \"curl\".");
  }

  let method: string | null = null;
  let url = "";
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  let isGet = false;
  let isHead = false;

  const next = (i: number, flag: string): string => {
    if (i + 1 >= tokens.length) throw new Error(`Missing value after ${flag}`);
    return tokens[i + 1];
  };

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok === "-X" || tok === "--request") {
      method = next(i, tok).toUpperCase();
      i++;
    } else if (tok === "-H" || tok === "--header") {
      const raw = next(i, tok);
      const sep = raw.indexOf(":");
      if (sep > 0) headers[raw.slice(0, sep).trim()] = raw.slice(sep + 1).trim();
      i++;
    } else if (
      tok === "-d" || tok === "--data" || tok === "--data-raw" ||
      tok === "--data-binary" || tok === "--data-ascii" || tok === "--data-urlencode"
    ) {
      dataParts.push(next(i, tok));
      i++;
    } else if (tok === "--json") {
      dataParts.push(next(i, tok));
      headers["Content-Type"] = "application/json";
      if (!headers["Accept"]) headers["Accept"] = "application/json";
      i++;
    } else if (tok === "-u" || tok === "--user") {
      headers["Authorization"] = "Basic " + btoa(next(i, tok));
      i++;
    } else if (tok === "-A" || tok === "--user-agent") {
      headers["User-Agent"] = next(i, tok);
      i++;
    } else if (tok === "-e" || tok === "--referer") {
      headers["Referer"] = next(i, tok);
      i++;
    } else if (tok === "-b" || tok === "--cookie") {
      headers["Cookie"] = next(i, tok);
      i++;
    } else if (tok === "--url") {
      url = next(i, tok);
      i++;
    } else if (tok === "-G" || tok === "--get") {
      isGet = true;
    } else if (tok === "-I" || tok === "--head") {
      isHead = true;
    } else if (IGNORED_WITH_ARG.has(tok)) {
      i++;
    } else if (tok.startsWith("-")) {
      // Unknown/no-arg flag (-s, -L, --compressed, …): ignore.
    } else if (!url) {
      url = tok;
    }
  }

  if (!url) throw new Error("No URL found in the curl command.");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let body: string | null = dataParts.length ? dataParts.join("&") : null;

  if (isGet && body) {
    url += (url.includes("?") ? "&" : "?") + body;
    body = null;
  }

  const resolvedMethod =
    method ?? (isHead ? "HEAD" : isGet ? "GET" : body ? "POST" : "GET");

  return { method: resolvedMethod, url, headers, body };
}
