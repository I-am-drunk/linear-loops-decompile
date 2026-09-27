/**
 * T-702 — schedule builder. Emits exactly the RRULE subset the engine
 * parses (see rruleBuilder.ts). Rules it can't model open in raw mode and
 * are preserved byte-identical; replacing one with a builder rule is an
 * explicit button press, never a silent rewrite.
 */
import type { JSX } from "react";
import type { LoopSchedule } from "../../../../../model/index.ts";
import type { BuilderState, BuilderFreq, WeekdayCode } from "./rruleBuilder.ts";
import {
  DEFAULT_BUILDER_STATE,
  WEEKDAY_CODES,
  WEEKDAY_LABELS,
  buildRRule,
  parseForBuilder,
} from "./rruleBuilder.ts";
import { Field } from "./controls.tsx";

export interface ScheduleBuilderProps {
  readonly schedule: LoopSchedule;
  readonly onChange: (next: LoopSchedule) => void;
}

const FREQ_UNITS: Record<BuilderFreq, string> = {
  MINUTELY: "minutes",
  HOURLY: "hours",
  DAILY: "days",
  WEEKLY: "weeks",
  MONTHLY: "months",
};

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, Math.trunc(n)));

function BuilderControls(props: {
  readonly state: BuilderState;
  readonly schedule: LoopSchedule;
  readonly onChange: (next: LoopSchedule) => void;
}): JSX.Element {
  const { state, schedule, onChange } = props;
  const emit = (next: BuilderState): void =>
    onChange({ ...schedule, rrule: buildRRule(next) });

  return (
    <>
      <div className="le-row">
        <Field label="Every">
          <span className="le-row">
            <input
              className="le-input le-num"
              type="number"
              min={1}
              value={state.interval}
              onChange={(e) =>
                emit({ ...state, interval: clamp(Number(e.target.value), 1, 9999) })
              }
            />
            <select
              className="le-input"
              value={state.freq}
              onChange={(e) => emit({ ...state, freq: e.target.value as BuilderFreq })}
            >
              {(Object.keys(FREQ_UNITS) as BuilderFreq[]).map((f) => (
                <option key={f} value={f}>{FREQ_UNITS[f]}</option>
              ))}
            </select>
          </span>
        </Field>
        {state.freq === "HOURLY" ? (
          <Field label="At minute">
            <input
              className="le-input le-num"
              type="number"
              min={0}
              max={59}
              value={state.minute}
              onChange={(e) => emit({ ...state, minute: clamp(Number(e.target.value), 0, 59) })}
            />
          </Field>
        ) : null}
        {state.freq === "DAILY" || state.freq === "WEEKLY" || state.freq === "MONTHLY" ? (
          <Field label="At">
            <span className="le-row">
              <input
                className="le-input le-num"
                type="number"
                min={0}
                max={23}
                value={state.hour}
                onChange={(e) => emit({ ...state, hour: clamp(Number(e.target.value), 0, 23) })}
                aria-label="Hour"
              />
              <span className="le-time-sep">:</span>
              <input
                className="le-input le-num"
                type="number"
                min={0}
                max={59}
                value={state.minute}
                onChange={(e) => emit({ ...state, minute: clamp(Number(e.target.value), 0, 59) })}
                aria-label="Minute"
              />
            </span>
          </Field>
        ) : null}
      </div>
      {state.freq === "WEEKLY" ? (
        <Field label="On days" hint="None selected = the day the schedule starts from">
          <span className="le-days">
            {WEEKDAY_CODES.map((d: WeekdayCode) => {
              const on = state.byDay.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`le-day${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    emit({
                      ...state,
                      byDay: on ? state.byDay.filter((x) => x !== d) : [...state.byDay, d],
                    })
                  }
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              );
            })}
          </span>
        </Field>
      ) : null}
    </>
  );
}

export function ScheduleBuilder(props: ScheduleBuilderProps): JSX.Element {
  const { schedule, onChange } = props;
  const parsed = parseForBuilder(schedule.rrule);

  return (
    <div className="le-sched">
      {parsed.mode === "builder" ? (
        <BuilderControls state={parsed.state} schedule={schedule} onChange={onChange} />
      ) : (
        <Field
          label="Schedule rule (raw)"
          hint="This rule uses RRULE parts the simple builder doesn't model. It's kept exactly as written."
        >
          <textarea
            className="le-input le-textarea-sm le-mono"
            value={schedule.rrule}
            onChange={(e) => onChange({ ...schedule, rrule: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}
      <div className="le-row le-sched-foot">
        <code className="le-rrule">{schedule.rrule}</code>
        {parsed.mode === "raw" ? (
          <button
            type="button"
            className="btn small"
            onClick={() =>
              onChange({ ...schedule, rrule: buildRRule(DEFAULT_BUILDER_STATE) })
            }
          >
            Replace with simple schedule
          </button>
        ) : null}
        <Field label="Timezone" hint="IANA name">
          <input
            className="le-input le-tz"
            value={schedule.timezone}
            onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
            placeholder="UTC"
          />
        </Field>
      </div>
    </div>
  );
}
