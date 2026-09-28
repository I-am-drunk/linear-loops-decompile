/**
 * AutomationOwnerSelect — clean reimplementation of the corpus chunk
 * `AutomationOwnerSelect.Cl2Nhq6T.js` export `t` (matrix §A "Owner select"
 * row; the loop-owner property/inline selector). Original code; the behavior
 * is verified byte-for-byte against the committed corpus-executed golden
 * (`golden/owner-select.branches.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * Corpus structure (hand-verified in the raw chunk): the component renders
 * UsersTooltip({users: [workflow.effectiveOwner]}) around a RENDER PROP that
 * receives {interactiveUsersTooltipContent} and builds the shared trigger
 * config:
 *   targets: [workflow] · action: AutomationHelper
 *   .getChangeAutomationOwnerAction(access) (base action when configure is
 *   not disabled; base + disabledReason() when disabled) ·
 *   dangerouslyNeverDisabled: access.configure.kind === "allowed" ·
 *   tooltipContentFactory · tooltipInteractive: true ·
 *   secondaryTrigger: {actions: [secondaryAction], targets: [owner]}
 * then renders the `inline` appearance branch
 *   ActionTrigger(config + noAriaLabel + noMinWidth + sx) > Button(
 *   variant borderless, size small, icon Avatar(tiny, no presence),
 *   iconContainerSize content, monotoneIcon false, sx inlineButton) >
 *   Text(mini, currentColor, truncate) > UserName(no link, no popover)
 * or the default `property` branch
 *   PropertyTrigger(config + sx [detailsProperty, sx]) > [Avatar(small, no
 *   presence), Text(small, labelTitle, truncate) > UserName(...)].
 * The chunk-local sx tables are pinned facts from the source:
 *   detailsProperty {kVQacm: sx-b3r6kr} · inlineButton {kmuXW: sx-s83m0k,
 *   kpe85a: sx-1ug7bdz}.
 *
 * The golden observes the tree with the component seams as string markers and
 * the helper action as an id-marked object (declared projection); this module
 * mirrors that observation exactly, parameterized over the same seams so the
 * test drives it with the golden's own markers.
 */

export interface OwnerUser {
  id: string;
  name: string;
}

export interface OwnerWorkflow {
  id: string;
  effectiveOwner: OwnerUser;
}

export interface OwnerAccessConfigure {
  kind: string;
  reason?: string;
}

export interface OwnerAccess {
  configure: OwnerAccessConfigure;
}

export interface OwnerAction {
  id: string;
  disabledReason?: () => string | undefined;
}

/** The seam markers the observation driver declares (the golden's stubs). */
export interface OwnerSelectSeams {
  usersTooltip: string;
  propertyTrigger: string;
  actionTrigger: string;
  button: string;
  text: string;
  avatar: string;
  userName: string;
  secondaryAction: string;
  baseAction: OwnerAction;
}

export interface OwnerSelectProps {
  workflow: OwnerWorkflow;
  access: OwnerAccess;
  appearance?: `property` | `inline`;
  sx?: unknown;
}

interface ProjectedElement {
  element: string;
  key: null;
  props: Record<string, unknown>;
}

function el(element: string, props: Record<string, unknown>): ProjectedElement {
  return { element, key: null, props };
}

const detailsProperty = { kVQacm: `sx-b3r6kr`, $$css: true } as const;
const inlineButton = { kmuXW: `sx-s83m0k`, kpe85a: `sx-1ug7bdz`, $$css: true } as const;

/** AutomationHelper.getChangeAutomationOwnerAction, reproduced exactly. */
export function getChangeAutomationOwnerAction(access: OwnerAccess, base: OwnerAction): OwnerAction {
  if (access.configure.kind !== `disabled`) return base;
  const { reason } = access.configure;
  return { ...base, disabledReason: () => reason };
}

export interface OwnerSelectRendering {
  tooltip: { element: string; props: { users: OwnerUser[] } };
  renderPropResult: ProjectedElement;
}

export function renderAutomationOwnerSelect(
  props: OwnerSelectProps,
  seams: OwnerSelectSeams,
  interactiveUsersTooltipContent: string,
): OwnerSelectRendering {
  const { workflow, access, appearance = `property`, sx } = props;
  const owner = workflow.effectiveOwner;
  const action = getChangeAutomationOwnerAction(access, seams.baseAction);
  const config = {
    targets: [workflow],
    action,
    dangerouslyNeverDisabled: access.configure.kind === `allowed`,
    tooltipContentFactory: interactiveUsersTooltipContent,
    tooltipInteractive: true,
    secondaryTrigger: { actions: [seams.secondaryAction], targets: [owner] },
  };
  const userName = el(seams.userName, { user: owner, enableLink: false, enablePopover: false });
  const renderPropResult =
    appearance === `inline`
      ? el(seams.actionTrigger, {
          ...config,
          noAriaLabel: true,
          noMinWidth: true,
          sx,
          children: el(seams.button, {
            variant: `borderless`,
            size: `small`,
            icon: el(seams.avatar, { user: owner, size: `tiny`, enablePresence: false }),
            iconContainerSize: `content`,
            monotoneIcon: false,
            sx: inlineButton,
            children: el(seams.text, {
              variant: `mini`,
              color: `currentColor`,
              truncate: true,
              children: userName,
            }),
          }),
        })
      : el(seams.propertyTrigger, {
          ...config,
          sx: [detailsProperty, sx],
          children: [
            el(seams.avatar, { user: owner, size: `small`, enablePresence: false }),
            el(seams.text, {
              variant: `small`,
              color: `labelTitle`,
              truncate: true,
              children: userName,
            }),
          ],
        });
  return {
    tooltip: { element: seams.usersTooltip, props: { users: [owner] } },
    renderPropResult,
  };
}
