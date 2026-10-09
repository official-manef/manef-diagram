<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		addEdge,
		addInventoryItem,
		blankChild,
		cloneGraph,
		defaultGraph,
		defaultInventory,
		diagramAt,
		layoutGraph,
		flowCard,
		parseGraphJson,
		parseImportedGraph,
		routeEdges,
		sameGraph,
		relatedView,
		searchInventory,
		inventoryCount,
		settleTick,
		traceGraph,
		validateGraph,
		buildDiagramViewUrl,
		parseDiagramView,
		tagGroup,
		tagsMatchFacets,
		writeDiagram,
		MAX_DIAGRAM_DEPTH
	} from './index';
	import type {
		ArchitectureEdge,
		ArchitectureGraph,
		ArchitectureNode,
		ArchitecturePort,
		DiagramMode,
		InventoryKind,
		Point,
		TraceMode
	} from './types';

	let root = $state<ArchitectureGraph>(cloneGraph(defaultGraph));
	let diagramPath = $state<string[]>([]);
	const graph = $derived(diagramAt(root, diagramPath) ?? root);
	let hydrated = $state(false);
	onMount(() => {
		try {
			const view = parseDiagramView(window.location.search);
			if (view.graph) root = view.graph;
			const opened = diagramAt(root, view.open);
			if (view.open.length > 0 && opened) diagramPath = [...view.open];
			else if (view.open.length > 0) {
				actionMessage = 'That component diagram is not in this map. The public map is shown.';
			}
			search = view.query;
			activeTags = view.tags;
			diagramMode = view.mode;
			traceMode = view.trace;
			focusMode = view.focus;
			if (view.seeds[0] && graph.nodes.some((node) => node.id === view.seeds[0])) {
				selectedNodeId = view.seeds[0];
			}
		} catch {
			actionMessage = 'This shared graph link is invalid or too large. The default graph is shown.';
		}
		jsonText = JSON.stringify(diagramAt(root, diagramPath) ?? root, null, 2);
		hydrated = true;
		const savedTheme = localStorage.getItem('manef-diagram-theme');
		if (
			savedTheme === 'composio-dark' ||
			savedTheme === 'composio-light' ||
			savedTheme === 'system'
		) {
			applyEditorTheme(savedTheme);
		}
	});

	let diagramMode = $state<DiagramMode>('flow');
	let traceMode = $state<TraceMode>('direct');
	let focusMode = $state(false);
	let search = $state('');
	let inventorySearch = $state('');
	let inventoryKind = $state<'all' | InventoryKind>('all');
	let activeTags = $state<string[]>([]);
	let selectedNodeId = $state<string | null>(null);
	let selectedEdgeId = $state<string | null>(null);
	let armedOutput = $state<{ nodeId: string; portId: string } | null>(null);
	let jsonText = $state(JSON.stringify(defaultGraph, null, 2));
	let jsonMessage = $state('');
	let actionMessage = $state('');
	let zoom = $state(0.72);
	let pan = $state({ x: 32, y: 28 });
	let overrides = $state<Record<string, Point>>({});
	let editorTheme = $state<'composio-dark' | 'composio-light' | 'system'>('composio-dark');
	let appliedTheme = $state<'composio-dark' | 'composio-light'>('composio-dark');
	let inspectorTab = $state<'details' | 'inventory' | 'json'>('details');
	let nodeDrag = $state<{
		nodeId: string;
		pointerId: number;
		offsetX: number;
		offsetY: number;
	} | null>(null);
	let panStart = $state<{
		pointerId: number;
		x: number;
		y: number;
		panX: number;
		panY: number;
	} | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let settleVelocity: Record<string, Point> = {};
	let settleFrame = 0;
	let settleHandle = 0;

	function stopSettle() {
		if (settleHandle) cancelAnimationFrame(settleHandle);
		settleHandle = 0;
	}

	onDestroy(stopSettle);

	function applyEditorTheme(next: 'composio-dark' | 'composio-light' | 'system') {
		editorTheme = next;
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		appliedTheme = next === 'system' ? (prefersDark ? 'composio-dark' : 'composio-light') : next;
		try {
			localStorage.setItem('manef-diagram-theme', next);
		} catch {
			/* the choice still applies for this visit */
		}
	}

	const positions = $derived(layoutGraph(graph, diagramMode));
	const basePositions = $derived(
		Object.fromEntries(
			graph.nodes.map((node) => [
				node.id,
				overrides[node.id] ?? positions[node.id] ?? { x: 0, y: 0 }
			])
		)
	);
	const trace = $derived(
		selectedNodeId ? traceGraph(graph, [selectedNodeId], traceMode) : { nodeIds: [], edgeIds: [] }
	);
	const highlightedNodeIds = $derived(new Set(trace.nodeIds));
	const highlightedEdgeIds = $derived(new Set(trace.edgeIds));
	const selectedNode = $derived(graph.nodes.find((node) => node.id === selectedNodeId));
	const selectedEdge = $derived(graph.edges.find((edge) => edge.id === selectedEdgeId));
	const allTags = $derived([...new Set(graph.nodes.flatMap((node) => node.tags))].sort());
	const tagGroups = $derived(
		Object.entries(
			allTags.reduce<Record<string, string[]>>(
				(groups, tag) => {
					const group = tagGroup(tag);
					groups[group] = [...(groups[group] ?? []), tag];
					return groups;
				},
				Object.create(null) as Record<string, string[]>
			)
		).sort(([a], [b]) => a.localeCompare(b))
	);
	const inventoryItems = $derived(
		searchInventory(
			defaultInventory,
			inventorySearch,
			[],
			inventoryKind === 'all' ? undefined : inventoryKind
		)
	);
	const worldStyle = $derived(`transform: translate(${pan.x}px, ${pan.y}px) scale(${zoom});`);

	function nodeMatches(node: ArchitectureNode) {
		const needle = search.trim().toLowerCase();
		const searchMatch =
			!needle ||
			[node.label, node.subtitle ?? '', ...node.tags].join(' ').toLowerCase().includes(needle);
		const tagMatch = tagsMatchFacets(node.tags, activeTags);
		const focusMatch = !focusMode || !selectedNodeId || highlightedNodeIds.has(node.id);
		return searchMatch && tagMatch && focusMatch;
	}

	const matchedNodes = $derived(graph.nodes.filter(nodeMatches));
	const related = $derived(
		relatedView(
			graph,
			matchedNodes.map((node) => node.id)
		)
	);
	const contextNodeIds = $derived(new Set(related.contextIds));
	const visibleNodes = $derived(graph.nodes.filter((node) => related.nodeIds.includes(node.id)));
	const visibleEdges = $derived(related.edges);
	const routes = $derived(routeEdges(graph, basePositions, diagramMode));
	const emphasize = $derived(Boolean(selectedNodeId) && highlightedNodeIds.size > 1);
	const fitKey = $derived(
		`${diagramPath.join('/')}:${diagramMode}:${graph.nodes.map((node) => `${node.id}@${node.level ?? 3}`).join('|')}:${visibleNodes
			.map((node) => node.id)
			.join(',')}:${focusMode}`
	);
	const crumbs = $derived.by(() => {
		const items: { depth: number; label: string }[] = [{ depth: 0, label: 'Public map' }];
		let current: ArchitectureGraph | undefined = root;
		for (let index = 0; index < diagramPath.length; index += 1) {
			const id = diagramPath[index];
			const node: ArchitectureNode | undefined = current?.nodes.find((item) => item.id === id);
			items.push({ depth: index + 1, label: node?.label || id });
			current = node?.child;
		}
		return items;
	});

	function facetChips(tags: string[]) {
		const chips: string[] = [];
		for (const namespace of ['kind', 'platform', 'project']) {
			const tag = tags.find((item) => item.startsWith(`${namespace}:`));
			if (tag) chips.push(tag.slice(namespace.length + 1));
		}
		return chips;
	}

	function tagCount(tag: string) {
		return graph.nodes.filter((node) => node.tags.includes(tag)).length;
	}

	function fitPoints(points: Record<string, Point>, ids: string[]) {
		if (!viewport) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const id of ids) {
			const point = points[id];
			if (!point) continue;
			minX = Math.min(minX, point.x);
			minY = Math.min(minY, point.y);
			maxX = Math.max(maxX, point.x + flowCard.width);
			maxY = Math.max(maxY, point.y + flowCard.height);
		}
		if (!Number.isFinite(minX)) return;
		for (const route of routes) {
			if (!visibleEdges.some((edge) => edge.id === route.id)) continue;
			for (const point of route.points) {
				minX = Math.min(minX, point.x - 12);
				minY = Math.min(minY, point.y - 18);
				maxX = Math.max(maxX, point.x + 12);
				maxY = Math.max(maxY, point.y + 8);
			}
		}
		const rect = viewport.getBoundingClientRect();
		if (rect.width < 40 || rect.height < 40) return;
		const pad = 28;
		const scale = Math.min(
			1.05,
			Math.max(
				0.4,
				Math.min((rect.width - pad * 2) / (maxX - minX), (rect.height - pad * 2) / (maxY - minY))
			)
		);
		zoom = scale;
		pan = {
			x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
			y: (rect.height - (maxY - minY) * scale) / 2 - minY * scale
		};
	}

	function fitView() {
		fitPoints(
			basePositions,
			visibleNodes.map((node) => node.id)
		);
	}

	$effect(() => {
		if (!hydrated) return;
		const key = fitKey;
		const ids = untrack(() => visibleNodes.map((node) => node.id));
		void key;
		void tick()
			.then(() =>
				fitPoints(
					untrack(() => basePositions),
					ids
				)
			)
			.catch(() => undefined);
	});

	function commitVisible(next: ArchitectureGraph) {
		root = writeDiagram(root, diagramPath, next);
	}

	function resetLevel() {
		stopSettle();
		selectedNodeId = null;
		selectedEdgeId = null;
		armedOutput = null;
		overrides = {};
		search = '';
		activeTags = [];
		focusMode = false;
	}

	function showDiagram(depth: number) {
		const nextPath = diagramPath.slice(0, depth);
		diagramPath = nextPath;
		resetLevel();
		jsonText = JSON.stringify(diagramAt(root, nextPath) ?? root, null, 2);
	}

	function openDiagram(id: string) {
		const visible = diagramAt(root, diagramPath) ?? root;
		const node = visible.nodes.find((item) => item.id === id);
		if (!node?.child) return;
		diagramPath = [...diagramPath, id];
		resetLevel();
		jsonText = JSON.stringify(node.child, null, 2);
	}

	function addComponentDiagram(id: string) {
		const node = graph.nodes.find((item) => item.id === id);
		if (!node || node.child || diagramPath.length >= MAX_DIAGRAM_DEPTH) return;
		commitVisible({
			...graph,
			nodes: graph.nodes.map((item) =>
				item.id === id ? { ...item, child: blankChild(item.label) } : item
			)
		});
		openDiagram(id);
	}

	function selectNode(id: string) {
		const node = graph.nodes.find((item) => item.id === id);
		if (selectedNodeId === id && node?.child) {
			openDiagram(id);
			return;
		}
		selectedNodeId = id;
		selectedEdgeId = null;
		inspectorTab = 'details';
	}

	function selectEdge(id: string) {
		selectedEdgeId = id;
		selectedNodeId = null;
		inspectorTab = 'details';
	}

	function updateNode(id: string, patch: Partial<ArchitectureNode>) {
		commitVisible({
			...graph,
			nodes: graph.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
		});
	}

	function updatePort(
		nodeId: string,
		direction: 'inputs' | 'outputs',
		portId: string,
		patch: Partial<ArchitecturePort>
	) {
		const node = graph.nodes.find((item) => item.id === nodeId);
		if (!node) return;
		updateNode(nodeId, {
			[direction]: node[direction].map((port) =>
				port.id === portId ? { ...port, ...patch } : port
			)
		} as Partial<ArchitectureNode>);
	}

	function addPort(nodeId: string, direction: 'inputs' | 'outputs') {
		const node = graph.nodes.find((item) => item.id === nodeId);
		if (!node) return;
		const prefix = direction === 'inputs' ? 'in' : 'out';
		const index = node[direction].length + 1;
		updateNode(nodeId, {
			[direction]: [...node[direction], { id: `${prefix}-${index}`, label: `${prefix} ${index}` }]
		} as Partial<ArchitectureNode>);
	}

	function removePort(nodeId: string, direction: 'inputs' | 'outputs', portId: string) {
		const node = graph.nodes.find((item) => item.id === nodeId);
		if (!node) return;
		const connected = graph.edges.some((edge) =>
			direction === 'inputs'
				? edge.target === nodeId && edge.targetPort === portId
				: edge.source === nodeId && edge.sourcePort === portId
		);
		if (
			connected &&
			!confirm('This port has connections. Remove the port and those connections?')
		) {
			return;
		}
		commitVisible({
			...graph,
			nodes: graph.nodes.map((item) =>
				item.id === nodeId
					? { ...item, [direction]: item[direction].filter((port) => port.id !== portId) }
					: item
			),
			edges: graph.edges.filter((edge) =>
				direction === 'inputs'
					? !(edge.target === nodeId && edge.targetPort === portId)
					: !(edge.source === nodeId && edge.sourcePort === portId)
			)
		});
	}

	function addNode() {
		const baseId = `node-${graph.nodes.length + 1}`;
		let id = baseId;
		let suffix = 1;
		while (graph.nodes.some((node) => node.id === id)) id = `${baseId}-${suffix++}`;
		const node: ArchitectureNode = {
			id,
			label: 'New node',
			subtitle: 'Describe this architecture item',
			tags: ['custom'],
			status: 'proposed',
			level: 3,
			inputs: [{ id: 'in', label: 'Consumes' }],
			outputs: [{ id: 'out', label: 'Provides' }]
		};
		commitVisible({ ...graph, nodes: [...graph.nodes, node] });
		selectNode(id);
	}

	function connectTo(targetNodeId: string, targetPortId: string) {
		if (!armedOutput) return;
		const edge: ArchitectureEdge = {
			id: `edge-${Date.now()}-${graph.edges.length}`,
			source: armedOutput.nodeId,
			sourcePort: armedOutput.portId,
			target: targetNodeId,
			targetPort: targetPortId,
			label: 'connects to',
			tags: ['custom']
		};
		const next = addEdge(graph, edge);
		commitVisible(next);
		jsonMessage = graph.edges.some((item) => item.id === edge.id)
			? 'Connection added. Output remains armed for another target.'
			: 'That connection already exists or is invalid.';
	}

	function disconnectEdge(id: string) {
		commitVisible({ ...graph, edges: graph.edges.filter((edge) => edge.id !== id) });
		selectedEdgeId = null;
	}

	function materialize(id: string) {
		const item = defaultInventory.find((candidate) => candidate.id === id);
		if (!item) return;
		const existing = graph.nodes.find(
			(node) =>
				node.id === item.id ||
				(item.kind !== undefined &&
					node.inventoryRef?.kind === item.kind &&
					node.inventoryRef.key === item.id)
		);
		if (existing) {
			selectNode(existing.id);
			inspectorTab = 'details';
			return;
		}
		commitVisible(addInventoryItem(graph, item));
		selectNode(item.id);
	}

	function syncJson() {
		jsonText = JSON.stringify(graph, null, 2);
		jsonMessage = 'JSON in the editor matches the map.';
	}

	function documentSnapshot() {
		return {
			schemaVersion: 1,
			title: 'MANEF Architecture',
			graph: root,
			ui: {
				themePreset: editorTheme,
				diagramMode,
				traceMode,
				focusMode
			}
		};
	}

	function exportJson() {
		const text = JSON.stringify(documentSnapshot(), null, 2);
		const file = new Blob([text], { type: 'application/json' });
		const href = URL.createObjectURL(file);
		const link = document.createElement('a');
		link.href = href;
		link.download = 'manef-architecture.json';
		link.click();
		URL.revokeObjectURL(href);
		actionMessage = 'Downloaded the map, its component diagrams, and the current view settings.';
		jsonMessage = actionMessage;
	}

	function applyImported(next: ArchitectureGraph) {
		root = next;
		diagramPath = [];
		resetLevel();
		jsonText = JSON.stringify(documentSnapshot(), null, 2);
		jsonMessage = 'JSON applied.';
	}

	function importJson() {
		try {
			const value: unknown = JSON.parse(jsonText);
			if (typeof value === 'object' && value !== null && 'graph' in value) {
				applyImported(parseImportedGraph(jsonText));
				return;
			}
			const next = parseGraphJson(jsonText);
			commitVisible(next);
			selectedNodeId = null;
			selectedEdgeId = null;
			armedOutput = null;
			jsonMessage = 'JSON applied.';
		} catch (error) {
			jsonMessage = error instanceof Error ? error.message : 'Invalid graph JSON.';
		}
	}

	function formatJson() {
		try {
			jsonText = JSON.stringify(JSON.parse(jsonText), null, 2);
			jsonMessage = 'Formatted.';
		} catch (error) {
			jsonMessage = error instanceof Error ? error.message : 'JSON error.';
		}
	}

	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			applyImported(parseImportedGraph(await file.text()));
			actionMessage = `Imported ${file.name}.`;
		} catch (error) {
			actionMessage = error instanceof Error ? error.message : 'Import failed.';
			jsonMessage = actionMessage;
		}
	}

	function retargetEdge(patch: Partial<ArchitectureEdge>) {
		if (!selectedEdge) return;
		const nextEdge = { ...selectedEdge, ...patch };
		if (patch.source) {
			const source = graph.nodes.find((node) => node.id === nextEdge.source);
			if (!source?.outputs.some((port) => port.id === nextEdge.sourcePort)) {
				nextEdge.sourcePort = source?.outputs[0]?.id ?? nextEdge.sourcePort;
			}
		}
		if (patch.target) {
			const target = graph.nodes.find((node) => node.id === nextEdge.target);
			if (!target?.inputs.some((port) => port.id === nextEdge.targetPort)) {
				nextEdge.targetPort = target?.inputs[0]?.id ?? nextEdge.targetPort;
			}
		}
		const next = {
			...graph,
			edges: graph.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge))
		};
		if (!validateGraph(next)) {
			jsonMessage = 'That connection already exists or the port does not match.';
			return;
		}
		commitVisible(next);
	}

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((item) => item !== tag)
			: [...activeTags, tag];
	}

	async function shareView() {
		try {
			const edited = !sameGraph(root, defaultGraph);
			const url = buildDiagramViewUrl({
				graph: edited ? root : undefined,
				query: search,
				tags: activeTags,
				seeds: selectedNodeId ? [selectedNodeId] : [],
				open: diagramPath,
				mode: diagramMode,
				trace: traceMode,
				focus: focusMode
			});
			const parsed = new URL(url);
			history.replaceState(history.state, '', `${parsed.pathname}${parsed.search}`);
			try {
				await navigator.clipboard.writeText(url);
				actionMessage = edited ? 'Link copied. It includes this edited map.' : 'Link copied.';
			} catch {
				actionMessage = 'The link is in the address bar. Copy it from there.';
			}
			jsonMessage = actionMessage;
		} catch (error) {
			actionMessage = error instanceof Error ? error.message : 'Could not create a portable link.';
			jsonMessage = actionMessage;
		}
	}

	function startNodeDrag(event: PointerEvent, nodeId: string) {
		const start = basePositions[nodeId] ?? { x: 0, y: 0 };
		nodeDrag = {
			nodeId,
			pointerId: event.pointerId,
			// grab offset in screen space: distance from pointer to node's rendered top-left
			offsetX: event.clientX - (pan.x + start.x * zoom),
			offsetY: event.clientY - (pan.y + start.y * zoom)
		};
		event.stopPropagation();
	}

	function moveNodeDrag(event: PointerEvent) {
		if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) return;
		overrides = {
			...overrides,
			[nodeDrag.nodeId]: {
				x: (event.clientX - pan.x - nodeDrag.offsetX) / zoom,
				y: (event.clientY - pan.y - nodeDrag.offsetY) / zoom
			}
		};
	}

	function stopNodeDrag(event: PointerEvent) {
		if (nodeDrag?.pointerId === event.pointerId) nodeDrag = null;
	}

	function startSettle() {
		stopSettle();
		diagramMode = 'graph';
		overrides = { ...layoutGraph(graph, 'graph') };
		settleVelocity = {};
		settleFrame = 0;
		const step = () => {
			if (settleFrame >= 90) {
				settleHandle = 0;
				return;
			}
			const next = settleTick(graph, overrides, settleVelocity);
			overrides = next.positions;
			settleVelocity = next.velocity;
			settleFrame += 1;
			settleHandle = requestAnimationFrame(step);
		};
		settleHandle = requestAnimationFrame(step);
	}

	function onKeydown(event: KeyboardEvent) {
		const tag = (event.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (event.key === 'Escape') armedOutput = null;
		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeId) {
			event.preventDefault();
			disconnectEdge(selectedEdgeId);
		}
	}

	function startPan(event: PointerEvent) {
		if (window.matchMedia('(max-width: 44rem)').matches) return;
		if (event.button === 1) {
			event.preventDefault();
			viewport?.setPointerCapture(event.pointerId);
			panStart = {
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				panX: pan.x,
				panY: pan.y
			};
			return;
		}
		if (event.button !== 0) return;
		const target = event.target as HTMLElement;
		if (target.closest('[data-interactive], .node, .edge-hit')) return;
		selectedNodeId = null;
		selectedEdgeId = null;
	}

	function movePan(event: PointerEvent) {
		if (!panStart || panStart.pointerId !== event.pointerId) return;
		pan = {
			x: panStart.panX + event.clientX - panStart.x,
			y: panStart.panY + event.clientY - panStart.y
		};
	}

	function stopPan(event: PointerEvent) {
		if (panStart?.pointerId === event.pointerId) panStart = null;
	}

	function handleWheel(event: WheelEvent) {
		if (window.matchMedia('(max-width: 44rem)').matches) return;
		event.preventDefault();
		zoom = Math.min(1.6, Math.max(0.4, zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>MANEF Architecture</title>
	<meta
		name="description"
		content="Explore and edit a reusable graph of MANEF products, infrastructure and modular features."
	/>
</svelte:head>

<main class="workspace" data-theme={appliedTheme}>
	<header class="topbar">
		<div class="brand">
			<div class="logo" aria-hidden="true">M</div>
			<div>
				<h1>MANEF Architecture</h1>
				<small
					>{diagramPath.length === 0
						? 'public service map'
						: (crumbs.at(-1)?.label ?? 'component diagram')}</small
				>
			</div>
		</div>
		<div class="segmented" aria-label="Diagram mode">
			<Button
				data-interactive
				variant={diagramMode === 'flow' ? 'default' : 'ghost'}
				aria-pressed={diagramMode === 'flow'}
				disabled={!hydrated}
				size="sm"
				onclick={() => {
					stopSettle();
					overrides = {};
					diagramMode = 'flow';
				}}>Flow</Button
			>
			<Button
				data-interactive
				variant={diagramMode === 'graph' ? 'default' : 'ghost'}
				aria-pressed={diagramMode === 'graph'}
				disabled={!hydrated}
				size="sm"
				onclick={startSettle}>Graph</Button
			>
		</div>
		{#if diagramPath.length > 0}
			<nav class="diagram-path" aria-label="Diagram level">
				{#each crumbs as crumb (crumb.depth)}
					{#if crumb.depth < diagramPath.length}
						<Button size="sm" variant="ghost" onclick={() => showDiagram(crumb.depth)}
							>{crumb.label}</Button
						>
						<span aria-hidden="true">/</span>
					{:else}
						<span aria-current="page">{crumb.label}</span>
					{/if}
				{/each}
			</nav>
		{/if}
		<div class="spacer"></div>
		<select
			class="theme-select"
			aria-label="Color theme"
			value={editorTheme}
			onchange={(event) => {
				const value = event.currentTarget.value;
				if (value === 'composio-dark' || value === 'composio-light' || value === 'system') {
					applyEditorTheme(value);
				}
			}}
		>
			<option value="composio-dark">Dark</option>
			<option value="composio-light">Light</option>
			<option value="system">System</option>
		</select>
		<div class="top-actions">
			<Button data-interactive variant="outline" size="sm" onclick={addNode}>+ Node</Button>
			<Button data-interactive variant="outline" size="sm" onclick={exportJson}>Export</Button>
			<Button data-interactive variant="outline" size="sm" onclick={() => fileInput?.click()}
				>Import</Button
			>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json"
				hidden
				onchange={importFile}
			/>
			<Button data-interactive variant="outline" size="sm" onclick={shareView}>Share view</Button>
		</div>
	</header>
	{#if actionMessage}<p class="toast" role="status">{actionMessage}</p>{/if}

	<div class="layout">
		<aside class="sidebar">
			<section class="search-section">
				<h2>Explore canvas</h2>
				<Input aria-label="Search graph" placeholder="Search graph…" bind:value={search} />
			</section>
			<section>
				<p class="help">A group matches any selected tag. Every group must match.</p>
				<div class="tag-groups" aria-label="Tag group filters">
					{#each tagGroups as [group, tags] (group)}
						<div class="tag-group">
							<strong>{group}</strong>
							<div class="tags">
								{#each tags as tag (tag)}
									<label class="tag-check">
										<input
											type="checkbox"
											checked={activeTags.includes(tag)}
											onchange={() => toggleTag(tag)}
										/>
										{tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag}
										<span class="count">{tagCount(tag)}</span>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
			<section>
				<h2>Highlight</h2>
				<div class="segmented full">
					<Button
						size="sm"
						variant={traceMode === 'direct' ? 'default' : 'ghost'}
						aria-pressed={traceMode === 'direct'}
						onclick={() => (traceMode = 'direct')}>Direct</Button
					>
					<Button
						size="sm"
						variant={traceMode === 'component' ? 'default' : 'ghost'}
						aria-pressed={traceMode === 'component'}
						onclick={() => (traceMode = 'component')}>All connected</Button
					>
				</div>
				{#if traceMode === 'component'}
					<p class="help">
						All connected lights the whole piece that contains the selection. This public map is one
						piece, so Direct is the view that shows neighbors.
					</p>
				{/if}
				<Button
					class="full-button"
					variant={focusMode ? 'default' : 'outline'}
					aria-pressed={focusMode}
					size="sm"
					onclick={() => (focusMode = !focusMode)}>Focus: {focusMode ? 'On' : 'Off'}</Button
				>
			</section>
			<section>
				<h2>This map</h2>
				<div class="metric">
					<span>Services</span>
					<span>
						{matchedNodes.length === graph.nodes.length
							? graph.nodes.length
							: `${matchedNodes.length} of ${graph.nodes.length}`}
					</span>
				</div>
				<div class="metric">
					<span>Connections</span>
					<span>
						{visibleEdges.length === graph.edges.length
							? graph.edges.length
							: `${visibleEdges.length} of ${graph.edges.length}`}
					</span>
				</div>
				<div class="metric">
					<span>References</span><span>{inventoryCount(defaultInventory, 'reference')}</span>
				</div>
				<div class="metric">
					<span>GitHub repos</span><span>{inventoryCount(defaultInventory, 'repo')}</span>
				</div>
				<div class="metric">
					<span>Root domains</span><span>{inventoryCount(defaultInventory, 'domain')}</span>
				</div>
				<div class="metric">
					<span>Hostnames</span><span>{inventoryCount(defaultInventory, 'hostname')}</span>
				</div>
				<div class="metric">
					<span>Convex DNS</span><span>{inventoryCount(defaultInventory, 'convex')}</span>
				</div>
				<p class="help">
					Middle-click empty space to pan. Click a curve to select it. Escape cancels an armed
					output, and Delete removes the selected connection. Private repository and domain records
					are not bundled; the counts above are only what this public app ships.
				</p>
			</section>
		</aside>

		<section class="canvas-shell">
			<div
				class="viewport"
				role="application"
				aria-label="MANEF architecture graph canvas"
				bind:this={viewport}
				onpointerdown={startPan}
				onauxclick={(event) => event.preventDefault()}
				onpointermove={(event) => {
					moveNodeDrag(event);
					movePan(event);
				}}
				onpointerup={(event) => {
					stopNodeDrag(event);
					stopPan(event);
				}}
				onpointercancel={(event) => {
					stopNodeDrag(event);
					stopPan(event);
				}}
				onwheel={handleWheel}
			>
				{#if visibleNodes.length === 0}
					<div class="empty-map">
						<p>No services match{search.trim() ? ` “${search.trim()}”` : ' these tags'}.</p>
						<Button
							size="sm"
							onclick={() => {
								search = '';
								activeTags = [];
							}}>Clear search and tags</Button
						>
					</div>
				{/if}
				<ol class="mobile-map">
					{#each [...visibleNodes].sort((a, b) => (a.level ?? 3) - (b.level ?? 3) || a.label.localeCompare(b.label)) as node (node.id)}
						<li>
							<button
								type="button"
								class="mobile-card"
								class:selected={selectedNodeId === node.id}
								onclick={() => selectNode(node.id)}
							>
								<span>
									<strong>{node.label}</strong>
									<small>{node.subtitle}</small>
								</span>
								<em aria-hidden="true" data-status={node.status ?? 'active'}
									>{node.status ?? 'active'}</em
								>
								{#if node.child}<span class="chip" aria-hidden="true">components</span>{/if}
							</button>
							{#each visibleEdges.filter((edge) => edge.source === node.id) as edge (edge.id)}
								<p class="mobile-edge">
									{edge.label ?? 'connects'} → {graph.nodes.find((item) => item.id === edge.target)
										?.label}
								</p>
							{/each}
						</li>
					{/each}
				</ol>
				<div class="world" style={worldStyle}>
					<svg class="edges" viewBox="0 0 2400 1800" aria-hidden="true">
						<defs>
							<marker
								id="arrow"
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="6"
								markerHeight="6"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z"></path>
							</marker>
						</defs>
						{#each visibleEdges as edge (edge.id)}
							{@const route = routes.find((item) => item.id === edge.id)}
							{#if route}
								<path
									d={route.d}
									class="edge-line"
									class:hot={highlightedEdgeIds.has(edge.id) || selectedEdgeId === edge.id}
									class:dim={emphasize && !highlightedEdgeIds.has(edge.id)}
									marker-end="url(#arrow)"
								></path>
								<path
									d={route.d}
									class="edge-hit"
									role="button"
									tabindex="0"
									aria-label={route.label}
									onclick={() => selectEdge(edge.id)}
									onkeydown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											selectEdge(edge.id);
										}
									}}
								></path>
								<text class="edge-label" x={route.x} y={route.y} text-anchor="middle"
									>{route.label}</text
								>
							{/if}
						{/each}
					</svg>

					{#each visibleNodes as node (node.id)}
						<article
							class="node"
							class:hot={highlightedNodeIds.has(node.id)}
							class:selected={selectedNodeId === node.id}
							class:dim={emphasize && !highlightedNodeIds.has(node.id)}
							class:context={contextNodeIds.has(node.id)}
							class:connecting={armedOutput?.nodeId === node.id}
							data-status={node.status ?? 'active'}
							style={`left: ${basePositions[node.id]?.x ?? 0}px; top: ${basePositions[node.id]?.y ?? 0}px; width: ${flowCard.width}px; height: ${flowCard.height}px;`}
							onpointerdown={(event) => {
								if (event.button !== 0) return;
								if (event.target instanceof Element && event.target.closest('[data-interactive]'))
									return;
								startNodeDrag(event, node.id);
							}}
						>
							<div class="node-head">
								<Button
									data-interactive
									class="node-select"
									variant="ghost"
									onclick={() => selectNode(node.id)}
								>
									<span>
										<strong>{node.label}</strong>
										<small>{node.subtitle}</small>
									</span>
								</Button>
							</div>
							<div class="node-tags">
								{#if node.child}<span class="chip">components</span>{/if}
								{#each facetChips(node.tags) as chip (chip)}
									<span class="chip">{chip}</span>
								{/each}
							</div>
							<div class="port-side inputs">
								{#each node.inputs as port (port.id)}
									<Button
										data-interactive
										size="sm"
										variant="outline"
										class="port-button"
										onclick={() => connectTo(node.id, port.id)}
									>
										<span class="socket"></span><span class="port-label">{port.label}</span>
									</Button>
								{/each}
							</div>
							<div class="port-side outputs">
								{#each node.outputs as port (port.id)}
									<Button
										data-interactive
										size="sm"
										variant={armedOutput?.nodeId === node.id && armedOutput?.portId === port.id
											? 'default'
											: 'outline'}
										class="port-button"
										onclick={() => (armedOutput = { nodeId: node.id, portId: port.id })}
									>
										<span class="port-label">{port.label}</span><span class="socket"></span>
									</Button>
								{/each}
							</div>
						</article>
					{/each}
				</div>
				<div class="floating">
					<Button size="sm" variant="default" aria-pressed="true">Select</Button>
					<Button size="sm" variant="outline" onclick={fitView}>Fit</Button>
					<Button size="sm" variant="outline" onclick={startSettle}>Settle</Button>
					{#if armedOutput}
						<Button size="sm" variant="outline" onclick={() => (armedOutput = null)}>Cancel</Button>
					{/if}
				</div>
				<div class="status">
					{diagramMode === 'flow' ? 'Flow' : 'Graph'} · {selectedNode
						? selectedNode.label
						: selectedEdge
							? 'connection'
							: armedOutput
								? 'output armed'
								: 'no selection'}
				</div>
				<div class="zoom">
					<Button size="sm" variant="outline" onclick={() => (zoom = Math.max(0.4, zoom * 0.9))}
						>−</Button
					>
					<span>{Math.round(zoom * 100)}%</span>
					<Button size="sm" variant="outline" onclick={() => (zoom = Math.min(1.6, zoom * 1.1))}
						>+</Button
					>
				</div>
			</div>
			{#if visibleEdges.length}
				<div class="edge-strip" aria-label="Connections">
					{#each visibleEdges as edge (edge.id)}
						<Button
							size="sm"
							variant={selectedEdgeId === edge.id ? 'default' : 'outline'}
							onclick={() => selectEdge(edge.id)}
						>
							{graph.nodes.find((node) => node.id === edge.source)?.label} · {edge.label ??
								'connects'} ·
							{graph.nodes.find((node) => node.id === edge.target)?.label}
						</Button>
					{/each}
				</div>
			{/if}
		</section>

		<aside class="inspector">
			<div class="tabs" role="tablist" aria-label="Inspector">
				<button
					type="button"
					role="tab"
					aria-selected={inspectorTab === 'details'}
					class:active={inspectorTab === 'details'}
					onclick={() => (inspectorTab = 'details')}>Details</button
				>
				<button
					type="button"
					role="tab"
					aria-selected={inspectorTab === 'inventory'}
					class:active={inspectorTab === 'inventory'}
					onclick={() => (inspectorTab = 'inventory')}>Inventory</button
				>
				<button
					type="button"
					role="tab"
					aria-selected={inspectorTab === 'json'}
					class:active={inspectorTab === 'json'}
					onclick={() => (inspectorTab = 'json')}>JSON</button
				>
			</div>

			{#if inspectorTab === 'inventory'}
				<div class="panel">
					<p class="help">
						These three references are not on the public map until you add one. Repository, domain,
						hostname, and Convex records stay out of the public seed.
					</p>
					<select
						class="theme-select"
						aria-label="Inventory type"
						value={inventoryKind}
						onchange={(event) => {
							const value = event.currentTarget.value;
							if (
								value === 'all' ||
								value === 'reference' ||
								value === 'repo' ||
								value === 'domain' ||
								value === 'hostname' ||
								value === 'convex'
							) {
								inventoryKind = value;
							}
						}}
					>
						<option value="all">All</option>
						<option value="reference">References</option>
						<option value="repo">GitHub repos</option>
						<option value="domain">Root domains</option>
						<option value="hostname">Hostnames</option>
						<option value="convex">Convex DNS</option>
					</select>
					<Input
						aria-label="Search inventory"
						placeholder="Search inventory…"
						bind:value={inventorySearch}
					/>
					<div class="inventory-list">
						{#each inventoryItems as item (item.id)}
							<div class="inventory-item">
								<div>
									<strong>{item.label}</strong>
									<small>{item.subtitle}</small>
								</div>
								<Button size="sm" variant="outline" onclick={() => materialize(item.id)}>
									{graph.nodes.some((node) => node.id === item.id) ? 'Open' : 'Add'}
								</Button>
							</div>
						{/each}
					</div>
				</div>
			{:else if inspectorTab === 'json'}
				<div class="panel">
					<textarea
						class="json"
						bind:value={jsonText}
						spellcheck="false"
						aria-label="Architecture graph JSON"></textarea>
					<div class="json-actions">
						<Button size="sm" variant="outline" onclick={syncJson}>Refresh</Button>
						<Button size="sm" variant="outline" onclick={formatJson}>Format</Button>
						<Button size="sm" onclick={importJson}>Apply JSON</Button>
					</div>
					{#if jsonMessage}<p class="help" aria-live="polite">{jsonMessage}</p>{/if}
				</div>
			{:else if selectedNode}
				<div class="panel">
					<h2>Node details</h2>
					{#if selectedNode.child}
						<Button size="sm" onclick={() => openDiagram(selectedNode.id)}
							>Open component diagram</Button
						>
						<p class="help">Click the selected service again to open its components.</p>
					{:else if diagramPath.length >= MAX_DIAGRAM_DEPTH}
						<p>This is as deep as a diagram can go.</p>
					{:else}
						<Button size="sm" variant="outline" onclick={() => addComponentDiagram(selectedNode.id)}
							>Add component diagram</Button
						>
					{/if}
					<label>
						<span>Label</span>
						<Input
							value={selectedNode.label}
							oninput={(event) => updateNode(selectedNode.id, { label: event.currentTarget.value })}
						/>
					</label>
					<label>
						<span>Subtitle</span>
						<Input
							value={selectedNode.subtitle ?? ''}
							oninput={(event) =>
								updateNode(selectedNode.id, { subtitle: event.currentTarget.value })}
						/>
					</label>
					<label>
						<span>Tags</span>
						<textarea
							rows="3"
							value={selectedNode.tags.join(', ')}
							aria-label="Tags"
							onchange={(event) =>
								updateNode(selectedNode.id, {
									tags: event.currentTarget.value
										.split(',')
										.map((tag) => tag.trim())
										.filter(Boolean)
								})}></textarea>
					</label>
					<div class="port-editor">
						<div>
							<div class="editor-heading">
								<strong>Inputs</strong>
								<Button
									size="sm"
									variant="outline"
									onclick={() => addPort(selectedNode.id, 'inputs')}>+</Button
								>
							</div>
							{#each selectedNode.inputs as port (port.id)}
								<div class="port-row">
									<Input
										value={port.label}
										oninput={(event) =>
											updatePort(selectedNode.id, 'inputs', port.id, {
												label: event.currentTarget.value
											})}
									/>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => removePort(selectedNode.id, 'inputs', port.id)}>×</Button
									>
								</div>
							{/each}
						</div>
						<div>
							<div class="editor-heading">
								<strong>Outputs</strong>
								<Button
									size="sm"
									variant="outline"
									onclick={() => addPort(selectedNode.id, 'outputs')}>+</Button
								>
							</div>
							{#each selectedNode.outputs as port (port.id)}
								<div class="port-row">
									<Input
										value={port.label}
										oninput={(event) =>
											updatePort(selectedNode.id, 'outputs', port.id, {
												label: event.currentTarget.value
											})}
									/>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => removePort(selectedNode.id, 'outputs', port.id)}>×</Button
									>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else if selectedEdge}
				<div class="panel">
					<h2>Connection details</h2>
					<label>
						<span>Label</span>
						<Input
							value={selectedEdge.label ?? ''}
							oninput={(event) =>
								commitVisible({
									...graph,
									edges: graph.edges.map((edge) =>
										edge.id === selectedEdge.id
											? { ...edge, label: event.currentTarget.value }
											: edge
									)
								})}
						/>
					</label>
					<p class="help">
						{selectedEdge.source}:{selectedEdge.sourcePort} → {selectedEdge.target}:{selectedEdge.targetPort}
					</p>
					<label>
						<span>Source node</span>
						<select
							class="theme-select"
							aria-label="Source node"
							value={selectedEdge.source}
							onchange={(event) => retargetEdge({ source: event.currentTarget.value })}
						>
							{#each graph.nodes as node (node.id)}
								<option value={node.id}>{node.label}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Source output</span>
						<select
							class="theme-select"
							aria-label="Source output"
							value={selectedEdge.sourcePort}
							onchange={(event) => retargetEdge({ sourcePort: event.currentTarget.value })}
						>
							{#each graph.nodes.find((node) => node.id === selectedEdge.source)?.outputs ?? [] as port (port.id)}
								<option value={port.id}>{port.label}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Target node</span>
						<select
							class="theme-select"
							aria-label="Target node"
							value={selectedEdge.target}
							onchange={(event) => retargetEdge({ target: event.currentTarget.value })}
						>
							{#each graph.nodes as node (node.id)}
								<option value={node.id}>{node.label}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Target input</span>
						<select
							class="theme-select"
							aria-label="Target input"
							value={selectedEdge.targetPort}
							onchange={(event) => retargetEdge({ targetPort: event.currentTarget.value })}
						>
							{#each graph.nodes.find((node) => node.id === selectedEdge.target)?.inputs ?? [] as port (port.id)}
								<option value={port.id}>{port.label}</option>
							{/each}
						</select>
					</label>
					<Button variant="destructive" size="sm" onclick={() => disconnectEdge(selectedEdge.id)}>
						Disconnect
					</Button>
				</div>
			{:else}
				<div class="panel">
					<div class="empty">
						<b>No selection</b>
						<p>Click a service to edit it, or click it again when it has components.</p>
					</div>
				</div>
			{/if}
		</aside>
	</div>
</main>

<style>
	.workspace {
		--background: #0b0d10;
		--foreground: #eef2f6;
		--card: #12161b;
		--card-foreground: #eef2f6;
		--popover: #12161b;
		--popover-foreground: #eef2f6;
		--primary: #8273f6;
		--primary-foreground: #f7f6ff;
		--secondary: #171c22;
		--secondary-foreground: #eef2f6;
		--muted: #171c22;
		--muted-foreground: #8f99a7;
		--accent: #27213f;
		--accent-foreground: #eef2f6;
		--destructive: #ef7589;
		--border: #282f38;
		--input: #282f38;
		--ring: #8273f6;
		--canvas: #0e1115;
		--surface-2: #171c22;
		--surface-3: #1d232b;
		--color-background: var(--background);
		--color-foreground: var(--foreground);
		--color-card: var(--card);
		--color-card-foreground: var(--card-foreground);
		--color-popover: var(--popover);
		--color-popover-foreground: var(--popover-foreground);
		--color-primary: var(--primary);
		--color-primary-foreground: var(--primary-foreground);
		--color-secondary: var(--secondary);
		--color-secondary-foreground: var(--secondary-foreground);
		--color-muted: var(--muted);
		--color-muted-foreground: var(--muted-foreground);
		--color-accent: var(--accent);
		--color-accent-foreground: var(--accent-foreground);
		--color-destructive: var(--destructive);
		--color-border: var(--border);
		--color-input: var(--input);
		--color-ring: var(--ring);
		height: 100dvh;
		display: grid;
		grid-template-rows: 54px minmax(0, 1fr);
		overflow: hidden;
		background: var(--background);
		color: var(--foreground);
		color-scheme: dark;
	}
	.workspace[data-theme='composio-light'] {
		--background: #f5f6f8;
		--foreground: #191b20;
		--card: #ffffff;
		--card-foreground: #191b20;
		--popover: #ffffff;
		--popover-foreground: #191b20;
		--primary: #6959dd;
		--primary-foreground: #ffffff;
		--secondary: #f1f3f6;
		--secondary-foreground: #191b20;
		--muted: #f1f3f6;
		--muted-foreground: #727b86;
		--accent: #eeebff;
		--accent-foreground: #191b20;
		--destructive: #c95066;
		--border: #e1e5ea;
		--input: #e1e5ea;
		--ring: #6959dd;
		--canvas: #f7f8fa;
		--surface-2: #fafbfc;
		--surface-3: #f1f3f6;
		--color-background: var(--background);
		--color-foreground: var(--foreground);
		--color-card: var(--card);
		--color-card-foreground: var(--card-foreground);
		--color-popover: var(--popover);
		--color-popover-foreground: var(--popover-foreground);
		--color-primary: var(--primary);
		--color-primary-foreground: var(--primary-foreground);
		--color-secondary: var(--secondary);
		--color-secondary-foreground: var(--secondary-foreground);
		--color-muted: var(--muted);
		--color-muted-foreground: var(--muted-foreground);
		--color-accent: var(--accent);
		--color-accent-foreground: var(--accent-foreground);
		--color-destructive: var(--destructive);
		--color-border: var(--border);
		--color-input: var(--input);
		--color-ring: var(--ring);
		color-scheme: light;
	}
	.topbar,
	.brand,
	.top-actions,
	.segmented,
	.diagram-path,
	.tags,
	.editor-heading,
	.port-row,
	.json-actions,
	.floating,
	.zoom {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.topbar {
		gap: 0.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		padding: 0 0.75rem;
	}
	.spacer {
		flex: 1;
	}
	.brand {
		min-width: 0;
		gap: 0.5rem;
	}
	.brand h1 {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.15;
	}
	.brand small,
	.help,
	.inspector small {
		color: var(--muted-foreground);
		font-size: 10px;
		line-height: 1.4;
	}
	.brand small {
		display: block;
		margin-top: 2px;
	}
	.logo {
		display: grid;
		width: 29px;
		height: 29px;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 8px;
		background: var(--foreground);
		color: var(--background);
		font-size: 11px;
		font-weight: 800;
	}
	.segmented {
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		padding: 3px;
	}
	.segmented.full {
		width: 100%;
	}
	.theme-select {
		height: 32px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--foreground);
		padding: 0 0.5rem;
		font-size: 11px;
	}
	.topbar :global(button),
	.segmented :global(button),
	.floating :global(button),
	.zoom :global(button),
	.tabs button {
		height: 32px;
	}
	.layout {
		min-height: 0;
		display: grid;
		grid-template-columns: 235px minmax(0, 1fr) 330px;
	}
	.sidebar,
	.inspector {
		min-height: 0;
		overflow: auto;
		background: var(--card);
	}
	.sidebar {
		border-right: 1px solid var(--border);
	}
	.inspector {
		border-left: 1px solid var(--border);
	}
	.sidebar section,
	.panel {
		display: grid;
		gap: 0.55rem;
		padding: 12px;
		border-bottom: 1px solid var(--border);
	}
	h2 {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 9.5px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.help,
	.empty p {
		margin: 0;
	}
	.tag-groups,
	.tag-group,
	.inventory-list {
		display: grid;
		gap: 0.45rem;
	}
	.tag-group > strong {
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}
	.tags {
		flex-wrap: wrap;
	}
	.metric {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px dashed var(--border);
		padding: 5px 0;
		font-size: 10px;
	}
	.metric span:last-child {
		font-weight: 700;
	}
	:global(.full-button) {
		width: 100%;
	}
	.canvas-shell {
		position: relative;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-width: 0;
		min-height: 0;
		background: var(--canvas);
	}
	.viewport {
		position: relative;
		min-height: 0;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
		background-image: radial-gradient(circle, var(--border) 0.9px, transparent 0.9px);
		background-size: 22px 22px;
	}
	.viewport:active {
		cursor: grabbing;
	}
	.world {
		position: absolute;
		inset: 0 auto auto 0;
		width: 2400px;
		height: 1800px;
		transform-origin: 0 0;
	}
	.edges {
		position: absolute;
		inset: 0;
		width: 2400px;
		height: 1800px;
		overflow: visible;
		color: var(--muted-foreground);
	}
	.edges path.edge-line {
		fill: none;
		stroke: var(--muted-foreground);
		stroke-width: 1.7;
		pointer-events: none;
	}
	.edges path.edge-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 14;
		cursor: pointer;
	}
	.edge-label {
		fill: var(--muted-foreground);
		stroke: var(--canvas);
		stroke-width: 4px;
		paint-order: stroke;
		font-size: 9px;
		pointer-events: none;
	}
	.edges path.edge-line.hot {
		stroke: var(--primary);
		stroke-width: 2.8;
	}
	.edges path.edge-line.dim {
		opacity: 0.08;
	}
	.edges marker path {
		fill: currentColor;
	}
	.node {
		position: absolute;
		display: flex;
		flex-direction: column;
		overflow: visible;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--card);
		box-shadow: 0 14px 38px rgba(0, 0, 0, 0.28);
		padding: 8px 10px;
	}
	.node.selected,
	.node.hot {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.node.connecting {
		outline: 2px solid #65c693;
		outline-offset: 2px;
	}
	.node.dim {
		opacity: 0.1;
	}
	.node.context {
		border-style: dashed;
	}
	.node-head {
		min-width: 0;
	}
	:global(.node-select) {
		height: auto !important;
		width: 100%;
		justify-content: flex-start;
		padding: 0;
		white-space: normal !important;
		text-align: left;
	}
	:global(.node-select) span {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	:global(.node-select) strong {
		font-size: 11.5px;
		font-weight: 750;
		line-height: 1.25;
		white-space: normal !important;
	}
	:global(.node-select) small {
		display: block;
		color: var(--muted-foreground);
		font-size: 9.5px;
		line-height: 1.3;
		white-space: normal !important;
	}
	.node-tags {
		display: flex;
		gap: 0.25rem;
		margin-top: 6px;
		overflow: hidden;
		color: var(--muted-foreground);
		font-size: 8.5px;
		white-space: nowrap;
	}
	.chip,
	.status,
	.mobile-card em {
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted-foreground);
		padding: 0 0.35rem;
		font-size: 8.5px;
		font-style: normal;
	}
	.port-side {
		position: absolute;
		z-index: 2;
		top: 28px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.port-side.inputs {
		left: 0;
		transform: translateX(-8px);
		align-items: flex-start;
	}
	.port-side.outputs {
		right: 0;
		transform: translateX(8px);
		align-items: flex-end;
	}
	:global(.port-button) {
		height: 18px !important;
		max-width: 7.2rem;
		padding: 0 0.2rem !important;
		font-size: 8px !important;
	}
	.port-label {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tag-check {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		padding: 0.12rem 0.4rem;
		font-size: 9px;
	}
	.tag-check input {
		margin: 0;
	}
	.panel .theme-select {
		width: 100%;
	}
	.socket {
		width: 8px;
		height: 8px;
		flex: 0 0 auto;
		border: 2px solid var(--card);
		border-radius: 50%;
		background: var(--muted-foreground);
		box-shadow: 0 0 0 1px var(--border);
	}
	.floating,
	.status,
	.zoom {
		position: absolute;
		z-index: 4;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--card);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
	}
	.floating {
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		padding: 4px;
	}
	.status {
		left: 10px;
		bottom: 10px;
		padding: 6px 8px;
		color: var(--muted-foreground);
		font-size: 9.5px;
	}
	.zoom {
		right: 10px;
		bottom: 10px;
		padding: 4px;
	}
	.zoom span {
		min-width: 40px;
		color: var(--muted-foreground);
		font-size: 9px;
		text-align: center;
	}
	.edge-strip {
		display: flex;
		flex-wrap: nowrap;
		max-width: 100%;
		height: 40px;
		gap: 0.35rem;
		overflow-x: auto;
		border-top: 1px solid var(--border);
		background: var(--card);
		padding: 0.35rem;
	}
	.edge-strip :global(button) {
		height: auto;
		min-height: 1.75rem;
		white-space: nowrap;
	}
	.tabs {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		border-bottom: 1px solid var(--border);
		background: var(--card);
	}
	.tabs button {
		flex: 1;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--muted-foreground);
		font-size: 10.5px;
		cursor: pointer;
	}
	.tabs button.active {
		border-bottom-color: var(--primary);
		color: var(--foreground);
	}
	label {
		display: grid;
		gap: 4px;
		color: var(--muted-foreground);
		font-size: 9px;
	}
	textarea,
	.json {
		width: 100%;
		min-height: 4.5rem;
		resize: vertical;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--foreground);
		padding: 8px;
		font:
			9px/1.4 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}
	.json {
		min-height: 520px;
	}
	.port-editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.port-row :global(input) {
		min-width: 0;
	}
	.inventory-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		padding: 7px;
	}
	.inventory-item div {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	.inventory-item strong {
		font-size: 10px;
		word-break: break-word;
	}
	.empty {
		padding: 25px 6px;
		color: var(--muted-foreground);
		font-size: 10px;
		text-align: center;
	}
	.empty b {
		display: block;
		margin-bottom: 0.4rem;
		color: var(--foreground);
	}
	.toast {
		position: fixed;
		z-index: 40;
		right: 0.75rem;
		bottom: 0.75rem;
		max-width: min(28rem, calc(100% - 1.5rem));
		border-radius: 10px;
		background: var(--foreground);
		color: var(--background);
		padding: 0.65rem 0.85rem;
		font-size: 0.85rem;
	}
	.empty-map {
		position: absolute;
		z-index: 3;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		background: color-mix(in srgb, var(--canvas) 88%, transparent);
	}
	.empty-map p {
		margin: 0;
		max-width: 22rem;
	}
	.mobile-map {
		display: none;
		gap: 0.65rem;
		margin: 0;
		padding: 0.75rem;
		list-style: none;
	}
	.mobile-card {
		display: flex;
		width: 100%;
		min-height: 44px;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--card);
		color: inherit;
		padding: 0.8rem 0.85rem;
		text-align: left;
	}
	.mobile-card span {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	.mobile-card.selected {
		outline: 2px solid var(--primary);
	}
	.mobile-edge {
		margin: 0.35rem 0 0 0.2rem;
		color: var(--muted-foreground);
		font-size: 0.8rem;
	}
	.count {
		margin-left: 0.25rem;
		opacity: 0.7;
	}
	.diagram-path {
		min-width: 0;
		flex-wrap: wrap;
	}

	@media (max-width: 44rem) {
		.workspace {
			height: auto;
			min-height: 100dvh;
			overflow: visible;
			grid-template-rows: auto auto;
		}
		.topbar {
			height: auto;
			flex-wrap: wrap;
			padding: 0.65rem;
		}
		.brand {
			flex: 1 1 12rem;
		}
		.spacer {
			display: none;
		}
		.layout {
			display: flex;
			flex-direction: column;
		}
		.sidebar {
			display: contents;
		}
		.sidebar > :not(.search-section) {
			display: none;
		}
		.search-section {
			order: 1;
			border-bottom: 1px solid var(--border);
			background: var(--card);
		}
		.canvas-shell {
			order: 2;
			height: auto;
			min-height: 0;
		}
		.inspector {
			order: 3;
			width: auto;
			border-left: 0;
			border-top: 1px solid var(--border);
		}
		.viewport {
			height: auto;
			min-height: 0;
			overflow: visible;
			cursor: default;
			touch-action: pan-y;
			background-image: none;
		}
		.world,
		.floating,
		.status,
		.zoom,
		.edge-strip {
			display: none;
		}
		.mobile-map {
			display: grid;
		}
		.port-editor,
		.json {
			min-height: 12rem;
		}
		.port-editor {
			grid-template-columns: 1fr;
		}
	}
</style>
