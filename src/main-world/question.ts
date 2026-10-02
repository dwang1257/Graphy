import {
  MAX_SNAPSHOT_CASES,
  MAX_SNAPSHOT_PARAMS,
  isSnapshotParam,
  type SnapshotParam,
} from "../shared/protocol.js";

export interface QuestionData {
  exampleTestcaseList: unknown;
  metaData: unknown;
}

export interface Question {
  cases: string[];
  lineCount: number | null;
  params?: SnapshotParam[];
}

const EDIT_CACHE_PREFIX = "QD_TESTCASE_CACHE_";

export const QUESTION_QUERY =
  "query($titleSlug: String!) { question(titleSlug: $titleSlug) { exampleTestcaseList metaData } }";

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(text: unknown): unknown {
  if (typeof text !== "string") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeLines(lines: string[]): string {
  return lines.map((line) => line.trim()).join("\n");
}

function normalizeCase(text: string): string {
  return normalizeLines(text.trim().split(/\r?\n/));
}

export function parseMetaData(metaData: unknown): Pick<Question, "lineCount" | "params"> | null {
  const meta = asObject(parseJson(metaData));
  if (!meta) return null;
  if (meta.systemdesign === true) return { lineCount: 2 };
  const params = meta.params;
  if (!Array.isArray(params) || params.length === 0 || params.length > MAX_SNAPSHOT_PARAMS) return null;
  if (!params.every(isSnapshotParam)) return null;
  return {
    lineCount: params.length,
    params: params.map(({ name, type }) => ({ name, type })),
  };
}

export function parseExampleCases(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry): entry is string => typeof entry === "string")
    .map(normalizeCase)
    .slice(0, MAX_SNAPSHOT_CASES);
}

export function parseQuestion(data: QuestionData): Question {
  const meta = parseMetaData(data.metaData);
  const question: Question = {
    cases: parseExampleCases(data.exampleTestcaseList),
    lineCount: meta?.lineCount ?? null,
  };
  if (meta?.params) question.params = meta.params;
  return question;
}

export function questionFromNextData(nextData: unknown, slug: string): QuestionData | null {
  const queries = asObject(asObject(asObject(asObject(nextData)?.props)?.pageProps)?.dehydratedState)?.queries;
  if (!Array.isArray(queries)) return null;
  for (const entry of queries) {
    const query = asObject(entry);
    const key = query?.queryKey;
    if (!Array.isArray(key) || key[0] !== "questionDetail") continue;
    if (asObject(key[1])?.titleSlug !== slug) continue;
    const question = questionData(asObject(asObject(query?.state)?.data)?.question);
    if (question) return question;
  }
  return null;
}

export function questionFromGraphql(body: unknown): QuestionData | null {
  return questionData(asObject(asObject(body)?.data)?.question);
}

function questionData(value: unknown): QuestionData | null {
  const question = asObject(value);
  return question ? { exampleTestcaseList: question.exampleTestcaseList, metaData: question.metaData } : null;
}

export function editCacheKey(slug: string): string {
  return EDIT_CACHE_PREFIX + slug;
}

export function parseEditCache(raw: string | null, lineCount: number | null): string[] | null {
  if (raw === null) return null;
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_SNAPSHOT_CASES) return null;
  const cases: string[] = [];
  for (const entry of parsed) {
    if (!Array.isArray(entry) || entry.length === 0) return null;
    if (!entry.every((param): param is string => typeof param === "string")) return null;
    if (lineCount !== null && entry.length !== lineCount) return null;
    if (entry.some((param) => /[\r\n]/.test(param))) return null;
    cases.push(normalizeLines(entry));
  }
  return cases;
}

function chunk(lines: string[], size: number): string[] | null {
  if (lines.length === 0 || lines.length % size !== 0) return null;
  const cases: string[] = [];
  for (let start = 0; start < lines.length; start += size) {
    cases.push(normalizeLines(lines.slice(start, start + size)));
  }
  return cases;
}

export function splitDataInput(dataInput: string, lineCount: number | null): string[] | null {
  if (dataInput.trim() === "") return null;
  const lines = dataInput.split(/\r?\n/);
  while (lines.at(-1)?.trim() === "") lines.pop();
  const cases = lineCount !== null && lineCount > 0 ? chunk(lines, lineCount) : null;
  return (cases ?? [normalizeCase(dataInput)]).slice(0, MAX_SNAPSHOT_CASES);
}
