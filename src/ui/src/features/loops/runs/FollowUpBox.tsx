/**
 * T-703 — the follow-up box. One input, three copy states by run status
 * (settled design, hub #21 00:14:52Z):
 *  - awaitingInput → answer the loop's question ("Send answer")
 *  - pending/waiting/active → steer the live run ("Steer")
 *  - complete/error/canceled → continue as a follow-up run ("Continue")
 * Emits one send intent; the container decides what it means.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { RunStatus } from "../../../../../model/index.ts";
import { followUpCopy } from "./format.ts";

export function FollowUpBox(props: {
  readonly status: RunStatus;
  readonly onSend: (text: string) => void;
}): JSX.Element {
  const [text, setText] = useState("");
  const copy = followUpCopy(props.status);
  const send = (): void => {
    const t = text.trim();
    if (t.length === 0) return;
    props.onSend(t);
    setText("");
  };
  return (
    <div className="lr-followup">
      <input
        className="le-input"
        value={text}
        placeholder={copy.placeholder}
        aria-label="Follow-up message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
        }}
      />
      <button type="button" className="btn primary" disabled={text.trim().length === 0} onClick={send}>
        {copy.button}
      </button>
    </div>
  );
}
