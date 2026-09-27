/**
 * T-702 — prompt block: the markdown the brain runs each time. Plain
 * textarea in v1 (the model's PromptContent is format: "markdown"); the
 * run-view renders it, the editor keeps it source-true.
 */
import type { JSX } from "react";
import type { LoopConfig } from "../../../../../model/index.ts";
import { Block, Field } from "./controls.tsx";

export function PromptBlock(props: {
  readonly config: LoopConfig;
  readonly onChange: (next: LoopConfig) => void;
}): JSX.Element {
  const { config, onChange } = props;
  return (
    <Block title="Prompt">
      <Field
        label="What should the loop do?"
        hint="Markdown. Runs verbatim each time the trigger fires and conditions pass."
      >
        <textarea
          className="le-input le-textarea le-mono"
          rows={8}
          value={config.prompt.markdown}
          onChange={(e) =>
            onChange({ ...config, prompt: { format: "markdown", markdown: e.target.value } })
          }
          placeholder="Describe what this loop should do each time it runs."
        />
      </Field>
    </Block>
  );
}
