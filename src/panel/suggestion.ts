export const SUGGESTION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSelv8FQwZ3qC_5y1QCCLGUY0eCRPKyFX5sc8ywwJdx41IAcKA/formResponse";

const KIND_ENTRY = "entry.1514885710";
const TEXT_ENTRY = "entry.1464379200";

export const SUGGESTION_MAX_LENGTH = 2000;

export const SUGGESTION_KINDS = [
  { label: "Feature", value: "New feature" },
  { label: "Bug", value: "Bug fix" },
  { label: "Speed", value: "Performance improvement" },
  { label: "Other", value: "General feedback" },
] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number]["value"];

export interface Suggestion {
  kind: SuggestionKind | undefined;
  text: string;
  slug: string;
  version: string;
}

export function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || "dev";
  } catch {
    return "dev";
  }
}

export function suggestionBody({ kind, text, slug, version }: Suggestion): URLSearchParams {
  const body = new URLSearchParams();
  if (kind) body.set(KIND_ENTRY, kind);
  body.set(TEXT_ENTRY, `${text.trim()}\n\n---\nGraphy ${version} | ${slug || "no problem"}`);
  body.set("fvv", "1");
  body.set("pageHistory", "0");
  return body;
}

export async function submitSuggestion(suggestion: Suggestion, fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl(SUGGESTION_FORM_URL, { method: "POST", mode: "no-cors", body: suggestionBody(suggestion) });
}
