# Graph and demo workflows

These stories describe the existing product scope. Browser-local edits and simulated
workspace actions do not establish authenticated ownership or production deployment.
The product requirements remain in [PRD.md](PRD.md).

| Role                              | User story                                           | Flow and acceptance                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public visitor                    | Understand relationships without credentials         | Open `/app`, search or select facets, inspect a service, trace direct neighbors or its component, and focus the result. Related services remain visible as context. Clear filters recovers an empty match.                                                                                                                 |
| Map editor                        | Change and share a portable architecture map         | Add a node or port, connect an output to an input, edit labels, then share or export. Port identities, endpoints, kinds, node groups, edge tags, and view titles count as edits. The exported/shared graph restores those changes. Invalid contracts are rejected before rendering.                                        |
| Component editor                  | Navigate and edit nested diagrams safely             | Select a node twice to enter its child diagram; use breadcrumbs to return. Additions and imports respect the maximum of three child levels measured from the root. A rejected import leaves the current map and entered JSON available and reports failure.                                                                |
| Phone or keyboard user            | Inspect and connect nodes without precision dragging | Use the readable service list and inspector connection controls, or switch to the bounded canvas. Keyboard selection and focus remain available. Canvas pan/zoom does not move node positions.                                                                                                                             |
| Demo builder                      | Try workspace actions with isolated local data       | Open `/embed/workspace`, install a sample app, add context, run a simulated workflow, and plan a domain. Switch between Product studio and Sandbox: each retains its own data. No live provider, model, DNS, or public seed changes occur.                                                                                 |
| Demo builder with an imported map | Continue using a custom or empty graph               | Import a graph, then add context, apps, runs, or domain plans. New IDs remain unique. A missing seed anchor does not create a dangling connection. Duplicate imported edge IDs are rejected.                                                                                                                               |
| Returning demo builder            | Recover from browser storage problems                | Reload a complete saved workspace, including its inactive workspace. Malformed or inconsistent state falls back to a fresh demo with a recovery message. The malformed stored source is not overwritten during restore. Denied storage uses memory for the visit.                                                          |
| Hosted authenticated owner        | Keep private data isolated                           | Sign in through the configured identity provider and exercise private backend reads/writes. Authorization and ownership must be checked by the backend. Local simulated sign-in supplies no identity. Real hosted consent, callback, refresh, CRUD, and two-account isolation remain separate acceptance gates in the PRD. |

Focused graph and workspace unit tests validate the contract, cloning, edited-map
comparison, depth limits, generated identifiers, and stored-state recovery. Browser
QA must additionally exercise hydration, error messages, navigation, keyboard focus,
mobile reflow, and clipboard denial. Record revision-specific results in the QA
report; the stories above are acceptance targets, not evidence that every hosted
integration has passed.

Import errors remain visible as status messages while recovery controls stay clickable.
The status toast contains no actions and does not intercept pointers. Refresh must
restore the current graph JSON after a rejected import, including on narrow phones.
Browser coverage checks this policy and uses a normal click without bypassing hit testing.
