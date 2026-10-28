# Framework adapters

The framework-neutral boundary is `slices/architecture-inventory/core.ts`. It exports graph, inventory, document, converter and tool helpers without Svelte, React, Next.js, Convex or browser globals. `index.ts` is the Svelte adapter: it re-exports the core plus the reference Svelte component.

## SvelteKit

```ts
import { defaultGraph, traceGraph } from '$features/architecture-inventory';

const connected = traceGraph(defaultGraph, ['architecture'], 'component');
```

The canonical MANEF UI imports `ArchitectureInventory` from the same barrel and mounts it from a thin route.

## Next.js

Copy/install the slice core contract and import the same pure functions from the consumer alias:

```ts
import { defaultGraph, traceGraph } from '@/features/architecture-inventory/core';

export function connectedArchitectureIds() {
	return traceGraph(defaultGraph, ['architecture'], 'component').nodeIds;
}
```

A Next.js consumer can render those contracts with React Flow, SVG, Canvas, or its own design system without changing the data model. Do not import the Svelte component from Next.js; the shared contract is the framework-neutral TypeScript core.

`bun run check:core` compiles a standalone consumer with no Svelte ambient declarations or application aliases. It is included in `bun run check`; it checks the shared TypeScript boundary, not a deployed Next.js application.
