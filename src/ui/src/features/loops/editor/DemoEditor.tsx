/**
 * T-702 — demo container for the pre-R9 registry wiring (house pattern:
 * "swap the containers, not the pages"). Holds the draft in local state so
 * the editor is fully interactive; publish/delete are no-ops until the T3
 * connect container replaces this.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { LoopConfig } from "../../../../../model/index.ts";
import { LoopEditorPage } from "./LoopEditorPage.tsx";
import { LoopEditorStyles } from "./styles.tsx";
import { demoEditorConfig, demoProjects, demoTeams, demoTrustedSources } from "./fixtures.ts";

const noop = (): void => {};

export function DemoEditor(props: {
  readonly initial?: LoopConfig | undefined;
  readonly publishedVersion?: number | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<LoopConfig>(props.initial ?? demoEditorConfig);
  return (
    <>
      <LoopEditorStyles />
      <LoopEditorPage
        draft={draft}
        onChange={setDraft}
        onPublish={noop}
        onDelete={noop}
        teams={demoTeams}
        projects={demoProjects}
        trustedSources={demoTrustedSources}
        dirty={true}
        publishedVersion={props.publishedVersion}
      />
    </>
  );
}
