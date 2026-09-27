/**
 * T-702 — conditions editor. All conditions must pass for a run to start
 * (SPECS/loops.md §condition-semantics). Four kinds, edited as a list:
 * watchedProperties, collectionChange, commentMatch, propertyFilter.
 * Add/remove/replace immutably; validation is mirrored live by validate.ts.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { LoopCondition, LoopConfig } from "../../../../../model/index.ts";
import { COLLECTION_CHANGE_OPERATIONS, PROPERTY_FILTER_OPS } from "../../../../../model/index.ts";
import { Block, Field } from "./controls.tsx";

export interface ConditionsBlockProps {
  readonly config: LoopConfig;
  readonly onChange: (next: LoopConfig) => void;
}

const KIND_LABELS: Record<LoopCondition["kind"], string> = {
  watchedProperties: "Watched properties",
  collectionChange: "Collection change",
  commentMatch: "Comment matches",
  propertyFilter: "Property filter",
};

function defaultCondition(kind: LoopCondition["kind"]): LoopCondition {
  switch (kind) {
    case "watchedProperties":
      return { kind, properties: [] };
    case "collectionChange":
      return { kind, property: "", operation: "addedOrRemoved" };
    case "commentMatch":
      return { kind, pattern: "", isRegex: false };
    case "propertyFilter":
      return { kind, property: "", op: "eq", value: "" };
  }
}

export function ConditionsBlock(props: ConditionsBlockProps): JSX.Element {
  const { config, onChange } = props;
  const conditions = config.conditions;
  const setAt = (i: number, c: LoopCondition): void =>
    onChange({ ...config, conditions: conditions.map((x, j) => (j === i ? c : x)) });
  const removeAt = (i: number): void =>
    onChange({ ...config, conditions: conditions.filter((_, j) => j !== i) });

  return (
    <Block title="Conditions">
      <p className="le-hint">All conditions must pass after the trigger fires.</p>
      {conditions.map((c, i) => (
        <div key={i} className="le-cond">
          <div className="le-cond-head">
            <span className="le-cond-kind">{KIND_LABELS[c.kind]}</span>
            <button
              type="button"
              className="btn small"
              aria-label={`Remove condition ${i + 1}`}
              onClick={() => removeAt(i)}
            >
              Remove
            </button>
          </div>

          {c.kind === "watchedProperties" ? (
            <Field label="Properties" hint="Comma-separated, e.g. stateId, assigneeId">
              <input
                className="le-input"
                value={c.properties.join(", ")}
                onChange={(e) =>
                  setAt(i, {
                    ...c,
                    properties: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
                  })
                }
                placeholder="stateId, assigneeId"
              />
            </Field>
          ) : null}

          {c.kind === "collectionChange" ? (
            <div className="le-row">
              <Field label="Collection property">
                <input
                  className="le-input"
                  value={c.property}
                  onChange={(e) => setAt(i, { ...c, property: e.target.value })}
                  placeholder="e.g. project.issues"
                />
              </Field>
              <Field label="Direction">
                <select
                  className="le-input"
                  value={c.operation}
                  onChange={(e) =>
                    setAt(i, {
                      ...c,
                      operation: e.target
                        .value as (typeof COLLECTION_CHANGE_OPERATIONS)[number],
                    })
                  }
                >
                  {COLLECTION_CHANGE_OPERATIONS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {c.kind === "commentMatch" ? (
            <>
              <Field label="Pattern">
                <input
                  className="le-input"
                  value={c.pattern}
                  onChange={(e) => setAt(i, { ...c, pattern: e.target.value })}
                  placeholder="Text or regex"
                />
              </Field>
              <label className="le-check">
                <input
                  type="checkbox"
                  checked={c.isRegex}
                  onChange={(e) => setAt(i, { ...c, isRegex: e.target.checked })}
                />
                Pattern is a regular expression
              </label>
            </>
          ) : null}

          {c.kind === "propertyFilter" ? (
            <div className="le-row">
              <Field label="Property">
                <input
                  className="le-input"
                  value={c.property}
                  onChange={(e) => setAt(i, { ...c, property: e.target.value })}
                  placeholder="e.g. priority"
                />
              </Field>
              <Field label="Op">
                <select
                  className="le-input"
                  value={c.op}
                  onChange={(e) =>
                    setAt(i, { ...c, op: e.target.value as (typeof PROPERTY_FILTER_OPS)[number] })
                  }
                >
                  {PROPERTY_FILTER_OPS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </Field>
              <Field label="Value" hint={c.op === "in" ? "Comma-separated list" : undefined}>
                <input
                  className="le-input"
                  value={Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}
                  onChange={(e) =>
                    setAt(i, {
                      ...c,
                      value:
                        c.op === "in"
                          ? e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter((s) => s.length > 0)
                          : e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          ) : null}
        </div>
      ))}

      <AddCondition onAdd={(kind) =>
        onChange({ ...config, conditions: [...conditions, defaultCondition(kind)] })
      } />
    </Block>
  );
}

function AddCondition(props: { readonly onAdd: (kind: LoopCondition["kind"]) => void }): JSX.Element {
  const [kind, setKind] = useState<LoopCondition["kind"]>("watchedProperties");
  return (
    <span className="le-row le-add">
      <select
        className="le-input le-add-kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as LoopCondition["kind"])}
        aria-label="Condition kind"
      >
        {(Object.keys(KIND_LABELS) as LoopCondition["kind"][]).map((k) => (
          <option key={k} value={k}>{KIND_LABELS[k]}</option>
        ))}
      </select>
      <button type="button" className="btn" onClick={() => props.onAdd(kind)}>
        Add condition
      </button>
    </span>
  );
}
