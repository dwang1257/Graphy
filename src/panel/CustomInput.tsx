import type { JSX, Ref } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

import { KIND_LABELS, isStructureKind, type StructureKind } from "../core/types.js";
import { MAX_CUSTOM_FIELDS, splitPastedValues, type CustomField, type FieldKind } from "./customCase.js";
import { CloseIcon } from "./icons.js";
import { memo } from "./memo.js";
import { NONE_KIND_LABEL, autoKindLabel, structureKindOptions } from "./structureKind.js";

interface Props {
  fields: CustomField[];
  canAddField: boolean;
  onValueChange: (index: number, value: string) => void;
  onKindChange: (index: number, kind: FieldKind) => void;
  onPasteValues: (index: number, values: string[]) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
  onApply: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
}

function fieldKindLabel(kind: FieldKind, detected: StructureKind | undefined): string {
  if (kind === "auto") return autoKindLabel([detected]);
  if (kind === "none") return NONE_KIND_LABEL;
  return KIND_LABELS[kind];
}

function toFieldKind(value: string): FieldKind {
  return value === "none" || isStructureKind(value) ? value : "auto";
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function CustomInputView(props: Props): JSX.Element {
  const { fields } = props;
  const baseId = useId();
  const fieldRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    const element = fieldRefs.current[focusIndex];
    if (!element) return;
    element.focus();
    setFocusIndex(null);
  }, [focusIndex, fields.length]);

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    props.onApply();
  };

  const onPaste = (index: number, event: JSX.TargetedClipboardEvent<HTMLTextAreaElement>): void => {
    const values = splitPastedValues(event.clipboardData?.getData("text/plain") ?? "");
    if (!values) return;
    event.preventDefault();
    props.onPasteValues(index, values);
    const last = props.canAddField ? MAX_CUSTOM_FIELDS - 1 : fields.length - 1;
    setFocusIndex(Math.min(index + values.length - 1, last));
  };

  return (
    <form
      class="custom-input"
      aria-label="Custom input"
      onSubmit={(event) => {
        event.preventDefault();
        props.onApply();
      }}
    >
      <div class="custom-input-fields">
        {fields.map((field, i) => {
          const id = `${baseId}-field-${i}`;
          const kindLabel = fieldKindLabel(field.kind, field.detected);
          return (
            <div class="custom-param" key={i}>
              <div class="custom-param-head">
                <label class="custom-param-name" for={id}>
                  <span class="custom-param-label">{field.name}</span>
                  {field.type && <span class="custom-param-type">{field.type}</span>}
                </label>
                {!field.scalar && (
                  <label class="custom-kind" title={`Structure for ${field.name}`}>
                    <span class="custom-kind-value" aria-hidden="true">{kindLabel}</span>
                    <select
                      class="custom-kind-select"
                      value={field.kind}
                      aria-label={`Structure for ${field.name}: ${kindLabel}`}
                      onChange={(event) => props.onKindChange(i, toFieldKind(event.currentTarget.value))}
                    >
                      <option value="auto">{autoKindLabel([field.detected])}</option>
                      <option value="none">{NONE_KIND_LABEL}</option>
                      {structureKindOptions().map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {field.removable && (
                  <button
                    type="button"
                    class="icon-btn custom-param-remove"
                    title={`Remove ${field.name}`}
                    aria-label={`Remove ${field.name}`}
                    onClick={() => {
                      props.onRemoveField(i);
                      setFocusIndex(Math.max(0, i - 1));
                    }}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
              <textarea
                id={id}
                ref={(element) => {
                  fieldRefs.current[i] = element;
                  if (i === 0) assignRef(props.inputRef, element);
                }}
                class="custom-input-field"
                rows={1}
                value={field.value}
                placeholder={field.placeholder}
                spellcheck={false}
                autocomplete="off"
                autocapitalize="off"
                onInput={(event) => props.onValueChange(i, event.currentTarget.value)}
                onKeyDown={onKeyDown}
                onPaste={(event) => onPaste(i, event)}
              />
            </div>
          );
        })}
      </div>
      {props.canAddField && (
        <button
          type="button"
          class="custom-add"
          onClick={() => {
            props.onAddField();
            setFocusIndex(fields.length);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add input
        </button>
      )}
      <button class="btn btn-solid custom-input-apply" type="submit">
        Draw
      </button>
    </form>
  );
}

export const CustomInput = memo(CustomInputView);
