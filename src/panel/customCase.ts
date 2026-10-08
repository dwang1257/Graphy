import { detectKinds } from "../core/build.js";
import { detectRole, isScalarType, structureKindOf } from "../core/detect.js";
import { scanInputValues } from "../core/parse/value.js";
import type { SigParam, Signature } from "../core/signature.js";
import { PANE_IDS, type KindChoice, type StructureKind } from "../core/types.js";

export type FieldKind = "auto" | KindChoice;

export interface CustomDraft {
  values: string[];
  kinds: FieldKind[];
}

export interface CustomCase {
  draft: CustomDraft;
  applied: CustomDraft;
  revision: number;
}

const EMPTY_DRAFT: CustomDraft = { values: [], kinds: [] };

export const EMPTY_CUSTOM_CASE: CustomCase = { draft: EMPTY_DRAFT, applied: EMPTY_DRAFT, revision: 0 };

export const MAX_CUSTOM_FIELDS = PANE_IDS.length;

export interface CustomField {
  name: string;
  type: string;
  placeholder: string;
  value: string;
  kind: FieldKind;
  detected?: StructureKind;
  scalar: boolean;
  removable: boolean;
}

function paramsOf(signature: Signature | null): SigParam[] | null {
  return signature && signature.params.length > 0 ? signature.params : null;
}

function fieldCount(draft: CustomDraft, signature: Signature | null): number {
  return paramsOf(signature)?.length ?? Math.min(MAX_CUSTOM_FIELDS, Math.max(1, draft.values.length));
}

export function customFields(draft: CustomDraft, signature: Signature | null): CustomField[] {
  const params = paramsOf(signature);
  const count = fieldCount(draft, signature);
  const values = Array.from({ length: count }, (_, i) => draft.values[i] ?? "");
  const detected = detectKinds(values, signature);
  return values.map((value, i) => {
    const param = params?.[i];
    const field: CustomField = {
      name: param?.name ?? `arg ${i + 1}`,
      type: param?.type ?? "",
      placeholder: placeholderFor(param),
      value,
      kind: draft.kinds[i] ?? "auto",
      scalar: param ? isScalarType(param.type) : false,
      removable: !params && count > 1,
    };
    const kind = detected[i];
    if (kind) field.detected = kind;
    return field;
  });
}

export function canAddField(draft: CustomDraft, signature: Signature | null): boolean {
  return !paramsOf(signature) && fieldCount(draft, signature) < MAX_CUSTOM_FIELDS;
}

export function setFieldValue(draft: CustomDraft, index: number, value: string): CustomDraft {
  if (index < 0 || index >= MAX_CUSTOM_FIELDS) return draft;
  const values = padded(draft.values, index + 1, "");
  values[index] = value;
  return { values, kinds: draft.kinds };
}

export function setFieldKind(draft: CustomDraft, index: number, kind: FieldKind): CustomDraft {
  if (index < 0 || index >= MAX_CUSTOM_FIELDS) return draft;
  const kinds = padded<FieldKind>(draft.kinds, index + 1, "auto");
  kinds[index] = kind;
  return { values: draft.values, kinds };
}

export function pasteValues(
  draft: CustomDraft,
  index: number,
  values: readonly string[],
  signature: Signature | null,
): CustomDraft {
  const end = Math.min(paramsOf(signature)?.length ?? MAX_CUSTOM_FIELDS, index + values.length);
  if (index < 0 || end <= index) return draft;
  const next = padded(draft.values, end, "");
  for (let i = index; i < end; i += 1) next[i] = values[i - index] ?? "";
  return { values: next, kinds: draft.kinds };
}

export function addField(draft: CustomDraft): CustomDraft {
  const count = Math.max(1, draft.values.length);
  if (count >= MAX_CUSTOM_FIELDS) return draft;
  return {
    values: [...padded(draft.values, count, ""), ""],
    kinds: padded<FieldKind>(draft.kinds, count + 1, "auto"),
  };
}

export function removeField(draft: CustomDraft, index: number): CustomDraft {
  if (index < 0 || index >= Math.max(1, draft.values.length)) return draft;
  const values = [...draft.values];
  const kinds = padded<FieldKind>(draft.kinds, values.length, "auto");
  values.splice(index, 1);
  kinds.splice(index, 1);
  return { values, kinds };
}

export function customInput(draft: CustomDraft): string {
  const values = draft.values.map((value) => value.trim().replace(/\s*\n\s*/g, " "));
  let last = values.length - 1;
  while (last >= 0 && !values[last]) last -= 1;
  return values.slice(0, last + 1).map((value) => value || "null").join("\n");
}

export function customKinds(draft: CustomDraft): Array<KindChoice | undefined> {
  return draft.kinds.map((kind) => (kind === "auto" ? undefined : kind));
}

export function splitPastedValues(text: string): string[] | null {
  const scanned = scanInputValues(text);
  return scanned.error || scanned.values.length < 2 ? null : scanned.values;
}

function padded<T>(items: readonly T[], length: number, fill: T): T[] {
  const out = [...items];
  while (out.length < length) out.push(fill);
  return out;
}

const ARRAY_MARK = /\[\]|\b(?:List|list|vector|Vec|Array)\s*[<[]/g;

function placeholderFor(param: SigParam | undefined): string {
  if (!param) return "[1,2,3,null,4]";
  const depth = param.type.match(ARRAY_MARK)?.length ?? 0;
  const kind = structureKindOf(detectRole(param, []));
  if (kind === "graph") return "[[0,1],[1,2]]";
  if (kind === "matrix" || depth > 1) return "[[1,0],[0,1]]";
  if (kind && depth === 1) return "[[1,4],[2,3]]";
  if (kind === "binary-tree") return "[1,2,3,null,4]";
  if (kind || depth === 1 || !isScalarType(param.type)) return "[1,2,3]";
  return "";
}
