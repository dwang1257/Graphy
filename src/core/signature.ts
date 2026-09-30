export interface SigParam {
  type: string;
  name: string;
}

export interface Signature {
  method: string;
  params: SigParam[];
}

type Lang =
  | "cpp"
  | "java"
  | "python"
  | "python3"
  | "javascript"
  | "typescript"
  | "csharp"
  | "golang"
  | "rust"
  | "kotlin"
  | "swift"
  | "scala"
  | "ruby"
  | "php"
  | "c";

const IDENTIFIER = /^[A-Za-z_]\w*$/;

const SKIP_METHODS = new Set([
  "main", "Solution", "init", "__init__", "new",
  "if", "for", "while", "switch", "catch", "return", "else", "do",
]);

export function parseSignature(code: string, lang: string): Signature | null {
  const source = stripComments(code, lang);
  const candidates = signatureCandidates(source, lang as Lang);

  for (const candidate of candidates) {
    if (SKIP_METHODS.has(candidate.method)) continue;
    const params = candidate.params.filter((p) => IDENTIFIER.test(p.name) && p.name !== "self");
    if (params.length === 0 || params.length !== candidate.params.filter((p) => p.name !== "self").length) continue;
    return { method: candidate.method, params: withJsDocTypes(params, code) };
  }
  return null;
}

function signatureCandidates(source: string, lang: Lang): Signature[] {
  const patterns = PATTERNS[lang] ?? PATTERNS.cpp ?? [];
  const out: Signature[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const method = match[1] ?? "";
      const list = match[2] ?? "";
      out.push({ method, params: splitParams(list).map((p) => splitTypeAndName(p, lang)) });
    }
  }
  return out;
}

const PATTERNS: Partial<Record<Lang, RegExp[]>> = {
  cpp: [/(?:^|\s)([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm],
  c: [/(?:^|\s)([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm],
  java: [/(?:public|private|protected)?\s*(?:static\s+)?[\w<>,\[\]\s?]+?\s+(\w+)\s*\(([^)]*)\)\s*\{/gm],
  csharp: [/(?:public|private|protected)?\s*(?:static\s+)?[\w<>,\[\]\s?]+?\s+(\w+)\s*\(([^)]*)\)\s*\{/gm],
  kotlin: [/fun\s+(\w+)\s*\(([^)]*)\)/gm],
  swift: [/func\s+(\w+)\s*\(([^)]*)\)/gm],
  scala: [/def\s+(\w+)\s*\(([^)]*)\)/gm],
  python: [/def\s+(\w+)\s*\(([^)]*)\)/gm],
  python3: [/def\s+(\w+)\s*\(([^)]*)\)/gm],
  ruby: [/def\s+(\w+)\s*\(([^)]*)\)/gm],
  php: [/function\s+(\w+)\s*\(([^)]*)\)/gm],
  golang: [/func\s+(\w+)\s*\(([^)]*)\)/gm],
  rust: [/fn\s+(\w+)\s*\(([^)]*)\)/gm],
  typescript: [
    /function\s+(\w+)\s*\(([^)]*)\)/gm,
    /(?:var|const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:function\s*)?\(([^)]*)\)/gm,
  ],
  javascript: [
    /(?:var|const|let)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/gm,
    /function\s+(\w+)\s*\(([^)]*)\)/gm,
  ],
};

function splitParams(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth <= 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((p) => p.trim()).filter(Boolean);
}

const TRAILING_NAME = /([A-Za-z_]\w*)\s*$/;

function splitTypeAndName(param: string, lang: Lang): SigParam {
  const text = param.replace(/=.*$/, "").trim();

  if (lang === "python" || lang === "python3" || lang === "typescript" ||
      lang === "swift" || lang === "kotlin" || lang === "scala" || lang === "rust") {
    const colon = text.indexOf(":");
    if (colon === -1) return { type: "", name: text.replace(/^[&*]|^mut\s+/, "").trim() };
    const name = text.slice(0, colon).trim().split(/\s+/).pop() ?? "";
    return { type: text.slice(colon + 1).trim(), name };
  }

  if (lang === "golang") {
    const parts = text.split(/\s+/);
    return { type: parts.slice(1).join(" "), name: parts[0] ?? "" };
  }

  const match = TRAILING_NAME.exec(text.replace(/\[\s*\]\s*$/, ""));
  if (!match) return { type: text, name: "" };
  const name = match[1]!;
  const type = text.slice(0, match.index).trim() + (text.endsWith("]") ? "[]" : "");
  return { type: type.replace(/[&\s]+$/, "").trim(), name };
}

const JSDOC_PARAM = /@param\s*\{([^}]+)\}\s*(\w+)/g;

function withJsDocTypes(params: SigParam[], code: string): SigParam[] {
  if (params.every((p) => p.type !== "")) return params;
  const types = new Map<string, string>();
  for (const match of code.matchAll(JSDOC_PARAM)) types.set(match[2]!, match[1]!);
  if (types.size === 0) return params;
  return params.map((p) => (p.type ? p : { ...p, type: types.get(p.name) ?? "" }));
}

function stripComments(code: string, lang: string): string {
  if (lang === "python" || lang === "python3" || lang === "ruby") {
    return code.replace(/#.*$/gm, "");
  }
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
