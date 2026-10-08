<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ecosystem } from './store.svelte';
	import { auditRows, roadmap } from '$features/directory';
	import {
		catalog,
		connectorCatalog,
		filterDemoNodes,
		mcpTools,
		simulateTool,
		type DemoNode
	} from './logic';

	let { surface = 'overview' }: { surface?: string } = $props();
	const demo = $derived(ecosystem.current);
	const connected = $derived(Object.values(demo.connections).filter(Boolean).length);
	const preview = $derived(page.url.searchParams.get('preview') === '1');

	let selectedId = $state('diagram');
	let query = $state('');
	let platforms = $state<string[]>([]);
	let kinds = $state<string[]>([]);
	let trace = $state<'direct' | 'component'>('direct');
	let tool = $state<string>(mcpTools[0]);
	let toolArgs = $state('{}');
	let toolResult = $state('');
	let toolFault = $state('');
	let importText = $state('');
	let importFault = $state('');

	const toolDefaults: Record<string, string> = {
		graph_status: '{}',
		graph_list_nodes: '{"tag":"kind:product"}',
		graph_list_edges: '{}',
		graph_trace: '{"seeds":["diagram"],"mode":"direct"}',
		graph_layout: '{"mode":"flow"}',
		graph_search_inventory: '{"query":"hermes"}',
		graph_adjacency: '{}',
		graph_query: '{"tags":["platform:web"]}',
		graph_build_view: '{"tags":["kind:product"]}',
		graph_create_portable_view: '{}'
	};
	const selected = $derived(demo.graph.nodes.find((node) => node.id === selectedId) ?? null);
	const platformTags = $derived([
		...new Set(
			demo.graph.nodes.flatMap((node) => node.tags.filter((tag) => tag.startsWith('platform:')))
		)
	]);
	const kindTags = $derived([
		...new Set(
			demo.graph.nodes.flatMap((node) => node.tags.filter((tag) => tag.startsWith('kind:')))
		)
	]);
	const visible = $derived(
		filterDemoNodes(demo.graph.nodes, query, { platform: platforms, kind: kinds })
	);
	const visibleIds = $derived(new Set(visible.map((node) => node.id)));
	const visibleEdges = $derived(
		demo.graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
	);
	const tracedIds = $derived.by(() => {
		if (!selectedId) return null;
		const result = simulateTool(demo, 'graph_trace', { seeds: [selectedId], mode: trace });
		return 'nodeIds' in result && Array.isArray(result.nodeIds)
			? result.nodeIds.filter((id): id is string => typeof id === 'string')
			: null;
	});
	const contextNodes = $derived(
		demo.graph.nodes.filter((node) => ['document', 'decision', 'memory'].includes(node.kind))
	);

	function point(id: string) {
		const node = demo.graph.nodes.find((item) => item.id === id);
		return node ? { x: node.x + 90, y: node.y + 28 } : { x: 0, y: 0 };
	}

	function toggle(list: string[], tag: string) {
		return list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag];
	}

	function startDrag(event: PointerEvent, node: DemoNode) {
		if (event.button !== 0) return;
		selectedId = node.id;
		const originX = node.x;
		const originY = node.y;
		const startX = event.clientX;
		const startY = event.clientY;
		const move = (ev: PointerEvent) => {
			ecosystem.place(node.id, originX + ev.clientX - startX, originY + ev.clientY - startY);
		};
		const stop = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', stop);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', stop);
	}

	function readForm(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return null;
		return { form, data: new FormData(form) };
	}

	function runTool() {
		toolFault = '';
		toolResult = '';
		try {
			const parsed: unknown = JSON.parse(toolArgs);
			toolResult = JSON.stringify(simulateTool(demo, tool, parsed), null, 2);
		} catch (error) {
			toolFault = error instanceof Error ? error.message : 'The simulation failed.';
		}
	}

	function download() {
		const blob = new Blob([JSON.stringify(demo, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'manef-demo-workspace.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

{#if surface === 'mso'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Shell · demo</p>
			<h1>MSO runtime</h1>
		</div>
		<button class="btn primary" type="button" onclick={() => ecosystem.run()}
			>Run demo workflow</button
		>
	</header>
	<p class="notice">
		A run stores a memory node in this browser. It does not call {demo.routing.primary}.
	</p>
	<div class="grid2" style="margin-top: 16px">
		<section class="card stack">
			<h2>Installed in this demo</h2>
			{#each demo.apps as id (id)}
				<p class="list-row">{catalog.find((item) => item.id === id)?.name ?? id}</p>
			{:else}
				<p class="muted">Nothing is installed. The catalog can simulate a managed install.</p>
			{/each}
		</section>
		<section class="card stack">
			<h2>Routing used by the next run</h2>
			<p>{demo.routing.primary}</p>
			<p class="muted">Fallback: {demo.routing.fallback} · {demo.routing.policy}</p>
			{#each demo.runs as run (run.id)}
				<p>{run.text}</p>
			{/each}
		</section>
	</div>
{:else if surface === 'diagram'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Demo graph</p>
			<h1>Workspace diagram</h1>
		</div>
		<a class="btn" href={resolve('/app')}>Open the public map</a>
	</header>
	{#if preview}
		<p class="notice">
			This preview flag does not replace the stored demo graph or the public map.
		</p>
	{/if}
	<div class="row wrap" style="margin-bottom: 12px">
		<label class="search">
			<span class="muted">Search</span>
			<input aria-label="Search demo graph" bind:value={query} />
		</label>
		<label class="field">
			Trace
			<select aria-label="Trace" bind:value={trace}>
				<option value="direct">Direct neighbors</option>
				<option value="component">Connected component</option>
			</select>
		</label>
	</div>
	<div class="row wrap" style="margin-bottom: 12px">
		{#each platformTags as tag (tag)}
			<label class="pill">
				<input
					type="checkbox"
					checked={platforms.includes(tag)}
					onchange={() => (platforms = toggle(platforms, tag))}
				/>
				{tag}
			</label>
		{/each}
		{#each kindTags as tag (tag)}
			<label class="pill">
				<input
					type="checkbox"
					checked={kinds.includes(tag)}
					onchange={() => (kinds = toggle(kinds, tag))}
				/>
				{tag}
			</label>
		{/each}
	</div>
	<div class="split">
		<div class="demo-map">
			<div class="map-wrap" style="position: relative; width: 1100px; height: 760px">
				<svg class="map-svg" viewBox="0 0 1100 760" aria-hidden="true">
					{#each visibleEdges as edge (edge.id)}
						<line
							x1={point(edge.source).x}
							y1={point(edge.source).y}
							x2={point(edge.target).x}
							y2={point(edge.target).y}
							stroke="#9aa894"
							stroke-width="1.5"
						/>
						<text
							x={(point(edge.source).x + point(edge.target).x) / 2}
							y={(point(edge.source).y + point(edge.target).y) / 2}
							fill="#667063"
							font-size="11"
						>
							{edge.label}
						</text>
					{/each}
				</svg>
				{#each visible as node (node.id)}
					<button
						class="demo-node"
						class:selected={node.id === selectedId}
						class:dim={tracedIds !== null && !tracedIds.includes(node.id)}
						style="left: {node.x}px; top: {node.y}px"
						type="button"
						onpointerdown={(event) => startDrag(event, node)}
					>
						<strong>{node.label}</strong>
						<small>{node.kind} · {node.status}</small>
					</button>
				{:else}
					<p class="notice" style="margin: 12px">No demo nodes match.</p>
				{/each}
			</div>
		</div>
		<aside class="card stack">
			<h2>Inspector</h2>
			{#if selected}
				<p><strong>{selected.label}</strong></p>
				<p class="muted">{selected.id} · drag the card, or nudge it.</p>
				<div class="row wrap">
					<button
						class="btn small"
						type="button"
						onclick={() => ecosystem.place(selected.id, selected.x, selected.y - 20)}>Up</button
					>
					<button
						class="btn small"
						type="button"
						onclick={() => ecosystem.place(selected.id, selected.x, selected.y + 20)}>Down</button
					>
					<button
						class="btn small"
						type="button"
						onclick={() => ecosystem.place(selected.id, selected.x - 20, selected.y)}>Left</button
					>
					<button
						class="btn small"
						type="button"
						onclick={() => ecosystem.place(selected.id, selected.x + 20, selected.y)}>Right</button
					>
				</div>
				<label class="field">
					Notes
					<textarea
						value={selected.notes}
						oninput={(event) => ecosystem.editNotes(selected.id, event.currentTarget.value)}
					></textarea>
				</label>
			{:else}
				<p class="muted">Select a demo node.</p>
			{/if}
			<h3>Links</h3>
			{#each demo.graph.edges as edge (edge.id)}
				<div class="list-row">
					<label class="field" style="flex: 1">
						{edge.source} → {edge.target}
						<input
							value={edge.label}
							onchange={(event) => ecosystem.renameLink(edge.id, event.currentTarget.value)}
						/>
					</label>
					<button class="btn small" type="button" onclick={() => ecosystem.unlink(edge.id)}
						>Delete</button
					>
				</div>
			{/each}
			<form
				class="stack"
				onsubmit={(event) => {
					const read = readForm(event);
					if (!read) return;
					ecosystem.link(
						String(read.data.get('source') ?? ''),
						String(read.data.get('target') ?? ''),
						String(read.data.get('label') ?? '')
					);
					read.form.reset();
				}}
			>
				<label class="field">
					From
					<select name="source" aria-label="Link from">
						{#each demo.graph.nodes as node (node.id)}
							<option value={node.id}>{node.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					To
					<select name="target" aria-label="Link to">
						{#each demo.graph.nodes as node (node.id)}
							<option value={node.id}>{node.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					Label
					<input name="label" required />
				</label>
				<button class="btn small" type="submit">Add demo link</button>
			</form>
			<p class="muted">
				Self-links and duplicate directions are rejected. This graph is not the public seed.
			</p>
		</aside>
	</div>
{:else if surface === 'context'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Context bank</p>
			<h1>Decisions, documents, memory</h1>
		</div>
	</header>
	<div class="grid2">
		<form
			class="card stack"
			onsubmit={(event) => {
				const read = readForm(event);
				if (!read) return;
				ecosystem.addContext(
					String(read.data.get('label') ?? ''),
					String(read.data.get('notes') ?? ''),
					String(read.data.get('kind') ?? 'document')
				);
				read.form.reset();
			}}
		>
			<label class="field">Label <input name="label" required /></label>
			<label class="field">
				Kind
				<select name="kind" aria-label="Context kind">
					<option value="document">Document</option>
					<option value="decision">Decision</option>
					<option value="memory">Memory</option>
				</select>
			</label>
			<label class="field">Notes <textarea name="notes"></textarea></label>
			<button class="btn primary" type="submit">Add to demo graph</button>
		</form>
		<div class="stack">
			{#each contextNodes as node (node.id)}
				<article class="card">
					<p class="pill">{node.kind}</p>
					<h2>{node.label}</h2>
					<p>{node.notes}</p>
				</article>
			{:else}
				<p class="notice">No context cards yet.</p>
			{/each}
		</div>
	</div>
{:else if surface === 'registry'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Catalog v1</p>
			<h1>Metadata, not an installer</h1>
		</div>
	</header>
	<div class="grid2">
		{#each catalog as app (app.id)}
			<article class="card stack">
				<p class="pill">{app.label}</p>
				<h2>{app.name}</h2>
				<p>{app.description}</p>
				<ul>
					{#each app.permissions as permission (permission)}
						<li>{permission}</li>
					{/each}
				</ul>
				{#if app.type === 'managed'}
					{#if demo.apps.includes(app.id)}
						<button class="btn" type="button" onclick={() => ecosystem.uninstall(app.id)}
							>Remove demo install</button
						>
					{:else}
						<button class="btn primary" type="button" onclick={() => ecosystem.install(app.id)}
							>Install in demo</button
						>
					{/if}
				{:else}
					<button
						class="btn"
						type="button"
						onclick={() => ecosystem.connect('n8n', !demo.connections.n8n)}
					>
						{demo.connections.n8n ? 'Mark n8n disconnected' : 'Connect existing n8n'}
					</button>
				{/if}
			</article>
		{/each}
	</div>
{:else if surface === 'models'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Proposed</p>
			<h1>Routing policy</h1>
		</div>
	</header>
	<p class="notice">Saving updates this browser only. There is no model API and no billing.</p>
	{#key `${demo.workspace}:${demo.routing.primary}:${demo.routing.fallback}:${demo.routing.policy}`}
		<form
			class="card stack"
			style="margin-top: 16px"
			onsubmit={(event) => {
				const read = readForm(event);
				if (!read) return;
				ecosystem.saveRouting(
					String(read.data.get('primary') ?? ''),
					String(read.data.get('fallback') ?? ''),
					String(read.data.get('policy') ?? 'Balanced')
				);
			}}
		>
			<label class="field"
				>Primary <input name="primary" value={demo.routing.primary} required /></label
			>
			<label class="field"
				>Fallback <input name="fallback" value={demo.routing.fallback} required /></label
			>
			<label class="field">
				Policy
				<select name="policy" aria-label="Routing policy">
					{#each ['Balanced', 'Quality', 'Cost'] as policy (policy)}
						<option selected={policy === demo.routing.policy}>{policy}</option>
					{/each}
				</select>
			</label>
			<button class="btn primary" type="submit">Save in this browser</button>
		</form>
	{/key}
{:else if surface === 'connectors'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Proposed</p>
			<h1>Sample connections</h1>
		</div>
	</header>
	<p class="notice">
		A mark is a flag in this demo. Convex here is not a public-map node and not Convex Cloud
		inventory.
	</p>
	<div class="card" style="margin-top: 16px">
		{#each connectorCatalog as item (item.id)}
			<div class="list-row">
				<div>
					<strong>{item.name}</strong>
					<p class="muted">{item.category}</p>
				</div>
				<button
					class="btn small"
					type="button"
					onclick={() => ecosystem.connect(item.id, !demo.connections[item.id])}
				>
					{demo.connections[item.id] ? 'Connected in demo' : 'Disconnected'}
				</button>
			</div>
		{/each}
	</div>
{:else if surface === 'ops'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Proposed</p>
			<h1>Operations</h1>
		</div>
	</header>
	<div class="grid2">
		<section class="card stack">
			<h2>Audit facts</h2>
			<p class="muted">These rows are the snapshot, not a live monitor.</p>
			{#each auditRows.filter((row) => row.area === 'Diagram' || row.area === 'MANEF') as row (row.id)}
				<p><span class="pill">{row.level}</span> {row.area} · {row.check}</p>
				<p class="muted">{row.evidence}</p>
			{/each}
		</section>
		<section class="card stack">
			<h2>Local deployment plans</h2>
			<form
				class="stack"
				onsubmit={(event) => {
					const read = readForm(event);
					if (!read) return;
					ecosystem.planDomain(String(read.data.get('host') ?? ''));
					read.form.reset();
				}}
			>
				<label class="field">Host label <input name="host" required /></label>
				<button class="btn" type="submit">Save plan locally</button>
			</form>
			{#each demo.domains as domain (domain.id)}
				<p><strong>{domain.host}</strong> — {domain.note}</p>
			{:else}
				<p class="muted">No local plan yet. Nothing is provisioned.</p>
			{/each}
		</section>
	</div>
{:else if surface === 'developers'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Local playground</p>
			<h1>Ten tools, no token</h1>
		</div>
		<a class="btn" href={resolve('/guide?section=mcp')}>Read the MCP guide</a>
	</header>
	<p class="notice">
		This does not POST to /api/mcp/server. Results say simulation and persisted false.
	</p>
	<form
		class="card stack"
		style="margin-top: 16px"
		onsubmit={(event) => {
			event.preventDefault();
			runTool();
		}}
	>
		<label class="field">
			Tool
			<select
				aria-label="MCP tool"
				bind:value={tool}
				onchange={() => (toolArgs = toolDefaults[tool] ?? '{}')}
			>
				{#each mcpTools as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			JSON object
			<textarea bind:value={toolArgs} rows="5"></textarea>
		</label>
		<button class="btn primary" type="submit">Simulate</button>
		{#if toolFault}<p class="notice">{toolFault}</p>{/if}
		{#if toolResult}<pre>{toolResult}</pre>{/if}
	</form>
{:else if surface === 'labs'}
	<header class="page-head">
		<div>
			<p class="eyebrow">Roadmap</p>
			<h1>Labs</h1>
		</div>
	</header>
	<p class="notice">A check stays in this browser. It does not close an issue or ship a product.</p>
	<div class="checks" style="margin-top: 16px">
		{#each roadmap as item (item.id)}
			<label class="card">
				<input
					type="checkbox"
					checked={(demo.reviews ?? []).includes(item.id)}
					onchange={() => ecosystem.review(item.id)}
				/>
				<span>
					<span class="pill">{item.priority}</span>
					<strong>{item.title}</strong>
					<p>{item.description}</p>
					<p class="muted">{item.product}</p>
				</span>
			</label>
		{/each}
	</div>
{:else if surface === 'settings'}
	<header class="page-head">
		<div>
			<p class="eyebrow">This browser</p>
			<h1>Demo settings</h1>
		</div>
	</header>
	<div class="grid2">
		<section class="card stack">
			<h2>Identity preview</h2>
			<p>{demo.profile.name} · {demo.profile.role}</p>
			<p class="muted">
				{demo.profile.signedIn ? 'Simulated sign-in is on.' : 'Simulated sign-in is off.'}
			</p>
			<button class="btn" type="button" onclick={() => ecosystem.toggleSignIn()}>
				{demo.profile.signedIn ? 'Simulated sign-out' : 'Simulated sign-in'}
			</button>
			<a class="btn primary" href={resolve('/auth/login')} data-sveltekit-reload
				>Sign in with MANEF</a
			>
			<p class="muted">
				The simulation does not create a MANEF session. The link does, when sign-in is configured.
			</p>
			<div class="row">
				<button class="btn small" type="button" onclick={() => ecosystem.setTheme('light')}
					>Light</button
				>
				<button class="btn small" type="button" onclick={() => ecosystem.setTheme('dark')}
					>Dark</button
				>
			</div>
		</section>
		<section class="card stack">
			<h2>Export or replace the demo graph</h2>
			<div class="row">
				<button class="btn" type="button" onclick={download}>Export JSON</button>
				<button
					class="btn"
					type="button"
					onclick={() => {
						if (confirm('Reset this demo workspace in this browser?')) ecosystem.reset();
					}}
				>
					Reset demo
				</button>
			</div>
			<form
				class="stack"
				onsubmit={(event) => {
					const read = readForm(event);
					if (!read) return;
					importFault = '';
					try {
						ecosystem.importGraph(String(read.data.get('json') ?? importText));
						importText = '';
						read.form.reset();
					} catch (error) {
						importFault = error instanceof Error ? error.message : 'Import failed.';
					}
				}}
			>
				<label class="field">
					Import JSON
					<textarea name="json" bind:value={importText} rows="6"></textarea>
				</label>
				<button class="btn" type="submit">Replace demo graph</button>
				{#if importFault}<p class="notice">{importFault}</p>{/if}
				<p class="muted">
					At most 40 nodes and 80 links. Installed demo apps stay. The public map is untouched.
				</p>
			</form>
		</section>
	</div>
{:else}
	<header class="page-head">
		<div>
			<p class="eyebrow">{demo.workspace}</p>
			<h1>Overview</h1>
		</div>
		<a class="btn" href={resolve('/app')}>Open the public map</a>
	</header>
	<div class="grid4">
		<article class="card stat">
			<p class="muted">Demo nodes</p>
			<p class="value">{demo.graph.nodes.length}</p>
		</article>
		<article class="card stat">
			<p class="muted">Demo links</p>
			<p class="value">{demo.graph.edges.length}</p>
		</article>
		<article class="card stat">
			<p class="muted">Demo installs</p>
			<p class="value">{demo.apps.length}</p>
		</article>
		<article class="card stat">
			<p class="muted">Sample connections</p>
			<p class="value">{connected}</p>
		</article>
	</div>
	<div class="grid2" style="margin-top: 16px">
		<section class="card stack">
			<h2>Try the demo</h2>
			<p><a href={resolve('/app')}>1. Open the public map.</a> That graph is the shipped seed.</p>
			<p>
				<a href={resolve('/workspace/[surface]', { surface: 'registry' })}
					>2. Install a catalog app in this demo.</a
				>
			</p>
			<p>
				<a href={resolve('/workspace/[surface]', { surface: 'context' })}>3. Add a context card.</a>
			</p>
			<p><a href={resolve('/audit')}>4. Read what is still unverified.</a></p>
		</section>
		<section class="card stack">
			<h2>Activity</h2>
			{#each demo.activities as item (item.id)}
				<p class="list-row"><span class="pill">{item.type}</span> {item.text}</p>
			{/each}
		</section>
	</div>
{/if}
