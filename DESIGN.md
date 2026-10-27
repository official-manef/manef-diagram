# Design contract

Design around the reader's task. This repository is a developer-facing starter: its
example screens can explain Svelte, configuration and architecture. A product built
from it should speak to that product's users and replace starter explanations with
useful tasks, real state and relevant content.

For this starter, preserve the neutral shell and existing navigation. Its design profile
is variance **4/10**, motion **2/10**, density **6/10**: restrained hierarchy, motion for
feedback, and readable working space. These are design decisions, not quality scores.
For a new product or requested redesign, first state the audience, main task, visual
direction and what must remain intact. Do not apply a marketing aesthetic to an editor
or replace a working layout just to make it look newly generated.

## Palette, measured

Values are the literals in `src/routes/layout.css`. Ratios computed from sRGB then
WCAG relative luminance, against the page ground in the same theme.

Light (`:root`, `layout.css:6-38`):

| token                | value     | use                         | contrast |
| -------------------- | --------- | --------------------------- | -------- |
| `--background`       | `#f4f4f7` | page ground                 |          |
| `--foreground`       | `#171719` | body text                   | 16.31:1  |
| `--card`             | `#f4f4f7` | panel ground                |          |
| `--secondary`        | `#ebebee` | inset blocks, control wells |          |
| `--muted-foreground` | `#656568` | secondary text              | 5.29:1   |
| `--border`           | `#d8d8db` | rules, dividers             |          |
| `--ring`             | `#1f6df0` | focus ring                  |          |
| `--destructive`      | `#ba334b` | destructive action          |          |

Dark (`.dark`, `layout.css:39-58`):

| token                | value                  | use            | contrast |
| -------------------- | ---------------------- | -------------- | -------- |
| `--background`       | `#171719`              | page ground    |          |
| `--foreground`       | `#f4f4f7`              | body text      | 16.31:1  |
| `--card`             | `#171719`              | panel ground   |          |
| `--muted-foreground` | `#b7b7bc`              | secondary text | 8.96:1   |
| `--border`           | translucent foreground | rules          |          |

Both themes clear 4.5:1 on every text token. `--primary` aliases `--foreground`
and `--primary-foreground` proxies `--background`, so the accent is "the ink
colour" rather than a second hue: this is an architecture explorer, and a second
hue would compete with the node-type colours the graph already needs.

## Type

- One family: `Inter` with a system fallback (`layout.css:107`). A diagram tool is
  read in long sessions next to code, so a neutral grotesque with a large x-height
  beats a display face that would only appear in four headings.
- Monospace (`--font-mono`, `layout.css:29`) is reserved for identifiers, schema
  names and code blocks. Never for labels or headings.
- Scale: `--app-touch-target: 2.75rem` sets the interactive floor. Body copy is
  14px in the workspace shell (`.eco`, `ecosystem.css:16`); table and dense metadata
  drop to 12px, and 10px is the floor, used only for table headers and eyebrow
  labels. Nothing renders below 10px.

## Dial

```
ENERGY  2   /* quiet working surface; the graph supplies the contrast, not the chrome */
RHYTHM  2   /* one shell, consistent sections, deliberate breaks at the audit table
               and the public directory listing */
MOTION  2   /* state feedback and one reveal; no ambient movement */
```

This restates the existing `variance 4/10, motion 2/10, density 6/10` profile on the
three-level scale: density maps to RHYTHM 2 (consistent, with breaks), motion maps
directly to MOTION 2, and the low variance is ENERGY 2.

## Allowed

- A ruled table with no card chrome, for comparable rows. The audit screen is the
  reference case.
- One accent per screen: focus ring and primary action. Node-type colour is data,
  not accent, and only appears inside the graph.
- Hairline borders instead of shadows to separate regions.
- Horizontal rails on narrow screens for peer content, with a visible continuation.
- Monospace for schema and function identifiers, in both themes.

## Forbidden

- A statistic, customer name or testimonial that is not a real row. The public
  directory lists the actual slice registry; the audit screen cites the file it read.
- An "AI powered", "seamless" or "production-ready" claim with no specific fact behind it.
- A second display typeface, a decorative gradient, glow, glass, or status dot with
  no information.
- A table that scrolls the document instead of its own container.
- Em dash in shipped copy.
- Text below 10px, or below 12px outside table headers and eyebrow labels.

## Sources and ownership

| Concern                                            | Edit here                                                |
| -------------------------------------------------- | -------------------------------------------------------- |
| Product name, description and public identity      | `src/lib/config/app.ts`                                  |
| Asset identity, paths and generation requirements  | `assets.config.ts`; [asset workflow](docs/assets.md)     |
| Colors, dimensions, radii and shell layout         | `src/routes/layout.css`                                  |
| Feature labels, icons, descriptions and navigation | `slices/app-shell/registry.ts` and each slice definition |
| Accessible base controls                           | `src/lib/components/ui/`                                 |
| Reusable app layout and interaction                | `src/lib/components/app-ui/`                             |
| Product screens and copy specific to a task        | `slices/<slug>/`                                         |

Do not create a parallel theme, asset URL list or menu array inside a screen. Keep
provider names and infrastructure details out of ordinary product flows unless they
help the user make a decision. Add a configuration field when it represents a shared
product choice; ordinary local labels do not all need to become global configuration.

## Copy that helps someone act

- Name the action or result in familiar words. Use one label per intent, such as
  "Save changes"; do not alternate with "Elevate your workspace" or "Unlock more".
- State what happened, what is required and what the user can do next. Keep errors
  beside the affected field/action. Avoid slogans, forced metaphors and praise for
  the implementation: "seamless", "next-gen", "AI-powered" or "production-ready"
  need a specific, relevant fact behind them.
- Describe only implemented behavior. A configured URL is not a successful connection;
  a local preview is not saved data; checkout creation is not payment confirmation.
- Every link and control must have a real destination or behavior. Remove empty
  actions and `href="#"` placeholders. When setup blocks an action, explain the
  requirement; do not manufacture success or add a button to an informational page.
- Use actual data. Clearly label demo fixtures in the visible UI; never invent customer
  logos, testimonials, business metrics, user counts or certifications to fill space.
- Keep a consistent tone and language across headings, labels, help, errors and metadata.
  Shorten repetitive copy; retain essential qualifications and recovery instructions.

| Situation                                        | Useful copy                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Developer starter with a URL but no response yet | "Convex URL configured. Check the result below to confirm the connection."   |
| Settings example without persistence             | "This is a local preview. Changes reset when you leave this page or reload." |
| Product save failed and input is retained        | "Changes could not be saved. Your entries are still here. Try again."        |
| Verified successful product save                 | "Changes saved."                                                             |

These are examples, not strings to copy into states that do not support the claim.

## Existing visual baseline

Semantic tokens such as `--background`, `--foreground`, `--primary`, `--muted`,
`--destructive`, `--border` and `--ring` have light/dark definitions in `layout.css`.
Use their Tailwind utilities instead of local color literals. The current base radius
is `0.5rem`; control and layout radii derive from it. UI text uses the configured
sans-serif stack, with monospace reserved for code or technical values.

Shell dimensions also come from tokens: `--app-touch-target`, `--app-topbar-height`,
`--app-mobile-dock-height`, grid minimum widths and rail card width. Change these tokens
when changing the shared rhythm, rather than patching every consuming component.
`src/lib/theme.svelte.ts` owns the light/dark/system preference, persisted at
`manef-theme-v1` when storage is available. It reads legacy preferences without deleting
local demo data. Public pages, the editor and app chrome use this same state; feature
styles alias semantic tokens and keep their own functional geometry. Change shared
colors in `layout.css`, rather than copying a palette into a page.

Keep the existing font and Lucide icon family unless the brand or usability task calls
for a change. Do not add fonts, icon packs, images or animation libraries for novelty.
Use whitespace, alignment and borders to establish hierarchy before adding cards,
shadows or visual effects. Avoid decorative gradients, glow, glass, status dots,
repeated eyebrows and pill labels with no information. A grid is appropriate for
comparable items or component examples, not a reason to invent equal-sized content.

## Layout and navigation

- One outer application shell owns header, desktop rail and mobile dock. Do not nest
  a second workspace shell inside a feature.
- Keep application surfaces full-width and `dvh` aware. A reading/form column may
  have a useful maximum width inside the shell.
- The shell owns one vertical scroll region, `[data-app-scroll]`. Keep fixed navigation
  outside it and reserve bottom/safe-area clearance so it cannot cover content.
- Breadcrumbs provide navigation context. The workspace switcher is a separate utility.
  The demo workspace selection is local UI state, not an authorization boundary.
- Use the same feature registry for navigation, route lookup and page metadata. Unknown
  slugs return a real not-found state; hidden navigation never substitutes for auth.
- Compose mobile content according to the task: list, rail, disclosure or adaptive grid.
  Do not shrink a desktop grid until labels or touch targets become unusable.

## Reuse the app primitives

| Primitive             | Contract                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `FeatureGrid`         | Content-aware `auto-fit/minmax`; choose density instead of fixed column counts.                         |
| `HorizontalRail`      | Peer content with horizontal scrolling and visible continuation; can become a grid.                     |
| `SegmentedControl`    | Native button group with `aria-pressed`; Tab/Enter/Space behavior, not fake tabs.                       |
| `SignalBanner`        | Important state or next action, not routine decorative text.                                            |
| `DisclosureCard`      | Secondary/setup content with native `details`/`summary` behavior.                                       |
| `ViewportSnapSection` | Proximity snapping only after measurement shows near-viewport content; never force short forms to snap. |

For true tab panels use an accessible tabs primitive with its complete keyboard and
panel relationships. Menus/dialogs must preserve focus, close with Escape where
appropriate and restore focus to their trigger. Prefer a native element when its
semantics fit; there is no blanket ban on `a`, `button`, `img` or form controls.

## States and accessibility

Each asynchronous task specifies loading, empty, success, failure and retry behavior.
Explain disabled features and required setup without implying that a selection enables
an integration. Keep errors near the affected field or action, announce relevant
updates, retain entered data on recoverable failure and prevent duplicate submission.
Destructive actions need a clear consequence and appropriate confirmation. Status
must remain understandable without color alone. Labels remain visible; placeholder
text and hover-only tooltips are not substitutes.

Provide a meaningful page title, one primary heading, labels, useful image alternatives,
visible keyboard focus and a sensible reading order. Decorative images use empty alt
text. Primary touch controls use the shared approximately 44px target. Check text and
interactive-state contrast against the product's accessibility target, including dark
mode, rather than relying on token names. Motion must respect reduced-motion preference
and must not be the only way to communicate state.

Keep document-level horizontal overflow at zero. Deliberate rails may scroll inside
their container. Verify long names, empty lists, errors, zoom and narrow screens; do
not rely on a screenshot containing only ideal demo data.

## Assets and interaction extensions

Use [the asset workflow](docs/assets.md) for favicon, app icons, social metadata images
and product imagery. Generate prompts from the shared identity/catalog, review the
result and then replace placeholders. Never put customer data or secrets in prompts.
Keep editable source artwork and useful image dimensions; avoid embedding essential
product copy into artwork where ordinary text is clearer.

Add drag-and-drop only for an actual spatial task. It needs a dedicated touch-sized
grip, pointer support, a keyboard equivalent, full destination targets, announcements,
server-authoritative persistence and rollback for failed optimistic updates. Ordinary
content must remain scrollable. These are acceptance requirements, not installed DnD
features.

## Design verification

Exercise the main task on desktop and narrow phone, then test keyboard-only use, menu
focus restoration and reduced motion. Review actual screenshots for clipping, hidden
actions and visual hierarchy. Record failing states in the product PRD and verify the
fix in the same viewport. Browser tests cover behavior; visual review covers what their
assertions cannot establish.

Read every visible string in context, including errors, alt text and metadata. Check
grammar, clear referents, truthful claims, functioning actions and consistent labels.
Use the [repository gates](AGENTS.md#finish-with-evidence) and report the states
actually exercised. A polished screenshot or a subjective "10/10" is not evidence of
accessibility, security, performance or production readiness.
