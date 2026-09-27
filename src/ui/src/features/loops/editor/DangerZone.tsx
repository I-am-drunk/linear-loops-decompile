/**
 * T-702 — danger zone: delete the loop. Disable lives on the list page's
 * switch (T-701); this is the irreversible action, styled and labeled as
 * such. The confirm step is the container's job (it owns the dialog).
 */
import type { JSX } from "react";
import { Block } from "./controls.tsx";

export function DangerZone(props: { readonly onDelete: () => void }): JSX.Element {
  return (
    <Block title="Danger zone">
      <div className="le-danger">
        <span className="le-hint">
          Deleting removes the loop, its drafts, and its schedule. Run history is kept.
        </span>
        <button type="button" className="btn le-danger-btn" onClick={props.onDelete}>
          Delete loop
        </button>
      </div>
    </Block>
  );
}
