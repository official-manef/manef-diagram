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
		graphNodeRadius,
		linkCount,
		parseGraphJson,
		parseImportedGraph,
		routeEdges,
		sameGraph,
		relatedView,
		searchInventory,
		inventoryCount,
		parseInventoryFilter,
		forceStep,
		defaultForces,
		traceGraph,
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
	import {
		appendPort,
		createNode,
		patchNode,
		patchPort,
		withEdgePatch,
		withoutPort
	} from './lib/edit';
	import { dotColor, facetChips, filterTagGroups, tagLabel } from './lib/present';
	import { hitByMarquee, marqueeMode, worldRect, type MarqueeMode } from './lib/select';
	import './editor.css';

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
	let tagQuery = $state('');
	let tagSort = $state<'name' | 'count'>('name');
	let filtersOpen = $state(false);
	let inventorySearch = $state('');
	let inventoryKind = $state<'all' | InventoryKind>('all');
	let activeTags = $state<string[]>([]);
	let selectedNodeId = $state<string | null>(null);
	let selectedNodeIds = $state<string[]>([]);
	let selectedEdgeIds = $state<string[]>([]);
	let hoveredNodeId = $state<string | null>(null);
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
		x: number;
		y: number;
		originX: number;
		originY: number;
	} | null>(null);
	let pointerMoved = false;
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
	let simAlpha = 1;
	let fitWhenCool = false;
	let forces = $state({ ...defaultForces });
	let marquee = $state<{
		x: number;
		y: number;
		width: number;
		height: number;
		mode: MarqueeMode;
	} | null>(null);
	let marqueeDrag: { pointerId: number; x: number; y: number; shift: boolean } | null = null;
	let settleHandle = 0;
	let motionHandle = 0;

	function stopMotion() {
		if (motionHandle) cancelAnimationFrame(motionHandle);
		motionHandle = 0;
	}

	function stopSettle() {
		if (settleHandle) cancelAnimationFrame(settleHandle);
		settleHandle = 0;
		stopMotion();
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
	const traceSeed = $derived(hoveredNodeId ?? selectedNodeId);
	const trace = $derived(
		traceSeed ? traceGraph(graph, [traceSeed], traceMode) : { nodeIds: [], edgeIds: [] }
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
	const visibleTagGroups = $derived(filterTagGroups(tagGroups, tagQuery, tagSort, tagCount));
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
	const emphasize = $derived(Boolean(traceSeed) && highlightedNodeIds.size > 1);
	const fitKey = $derived(
		`${diagramPath.join('/')}:${graph.nodes.map((node) => `${node.id}@${node.level ?? 3}`).join('|')}:${visibleNodes
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

	function tagCount(tag: string) {
		return graph.nodes.filter((node) => node.tags.includes(tag)).length;
	}

	function nodeRadius(id: string) {
		return graphNodeRadius(linkCount(graph, id));
	}

	function fitPoints(points: Record<string, Point>, ids: string[], animate = false) {
		if (!viewport) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const id of ids) {
			const point = points[id];
			if (!point) continue;
			if (diagramMode === 'graph') {
				const radius = nodeRadius(id);
				minX = Math.min(minX, point.x - radius - 16);
				minY = Math.min(minY, point.y - radius - 12);
				maxX = Math.max(maxX, point.x + radius + 148);
				maxY = Math.max(maxY, point.y + radius + 12);
			} else {
				minX = Math.min(minX, point.x);
				minY = Math.min(minY, point.y);
				maxX = Math.max(maxX, point.x + flowCard.width);
				maxY = Math.max(maxY, point.y + flowCard.height);
			}
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
		const nextPan = {
			x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
			y: (rect.height - (maxY - minY) * scale) / 2 - minY * scale
		};
		if (!animate) {
			zoom = scale;
			pan = nextPan;
			return;
		}
		const fromZoom = zoom;
		const fromPan = pan;
		const started = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - started) / 560);
			const eased = 1 - (1 - t) ** 3;
			zoom = fromZoom + (scale - fromZoom) * eased;
			pan = {
				x: fromPan.x + (nextPan.x - fromPan.x) * eased,
				y: fromPan.y + (nextPan.y - fromPan.y) * eased
			};
			motionHandle = t < 1 ? requestAnimationFrame(step) : 0;
		};
		stopMotion();
		motionHandle = requestAnimationFrame(step);
	}

	function showFlow() {
		stopSettle();
		const from: Record<string, Point> = {};
		for (const node of graph.nodes) {
			const point = basePositions[node.id] ?? { x: 0, y: 0 };
			from[node.id] =
				diagramMode === 'graph'
					? { x: point.x - flowCard.width / 2, y: point.y - flowCard.height / 2 }
					: point;
		}
		diagramMode = 'flow';
		const to = layoutGraph(graph, 'flow');
		const started = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - started) / 680);
			const eased = 1 - (1 - t) ** 3;
			const next: Record<string, Point> = {};
			for (const node of graph.nodes) {
				const start = from[node.id] ?? to[node.id] ?? { x: 0, y: 0 };
				const end = to[node.id] ?? start;
				next[node.id] = {
					x: start.x + (end.x - start.x) * eased,
					y: start.y + (end.y - start.y) * eased
				};
			}
			overrides = next;
			if (t < 1) {
				settleHandle = requestAnimationFrame(step);
				return;
			}
			settleHandle = 0;
			overrides = {};
			void tick()
				.then(() => fitView(true))
				.catch(() => undefined);
		};
		settleHandle = requestAnimationFrame(step);
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
		selectedNodeIds = [];
		selectedEdgeId = null;
		selectedEdgeIds = [];
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

	function rememberSelection(nodeIds: string[], edgeIds: string[]) {
		selectedNodeIds = nodeIds;
		selectedEdgeIds = edgeIds;
		selectedNodeId = nodeIds.length === 1 ? nodeIds[0] : null;
		selectedEdgeId = nodeIds.length === 0 && edgeIds.length === 1 ? edgeIds[0] : null;
		if (nodeIds.length === 1 || edgeIds.length === 1) inspectorTab = 'details';
	}

	function selectNode(id: string, fromPointer = false, additive = false) {
		if (fromPointer && pointerMoved) {
			pointerMoved = false;
			return;
		}
		pointerMoved = false;
		const node = graph.nodes.find((item) => item.id === id);
		if (!additive && selectedNodeId === id && node?.child) {
			openDiagram(id);
			return;
		}
		if (additive) {
			const nodeIds = selectedNodeIds.includes(id)
				? selectedNodeIds.filter((item) => item !== id)
				: [...selectedNodeIds, id];
			rememberSelection(nodeIds, selectedEdgeIds);
			return;
		}
		rememberSelection([id], []);
	}

	function selectEdge(id: string, additive = false) {
		if (additive) {
			const edgeIds = selectedEdgeIds.includes(id)
				? selectedEdgeIds.filter((item) => item !== id)
				: [...selectedEdgeIds, id];
			rememberSelection(selectedNodeIds, edgeIds);
			return;
		}
		rememberSelection([], [id]);
	}

	function updateNode(id: string, patch: Partial<ArchitectureNode>) {
		commitVisible(patchNode(graph, id, patch));
	}

	function updatePort(
		nodeId: string,
		direction: 'inputs' | 'outputs',
		portId: string,
		patch: Partial<ArchitecturePort>
	) {
		commitVisible(patchPort(graph, nodeId, direction, portId, patch));
	}

	function addPort(nodeId: string, direction: 'inputs' | 'outputs') {
		commitVisible(appendPort(graph, nodeId, direction));
	}

	function removePort(nodeId: string, direction: 'inputs' | 'outputs', portId: string) {
		const connected = graph.edges.some((edge) =>
			direction === 'inputs'
				? edge.target === nodeId && edge.targetPort === portId
				: edge.source === nodeId && edge.sourcePort === portId
		);
		if (
			connected &&
			typeof confirm === 'function' &&
			!confirm('This port has connections. Remove the port and those connections?')
		) {
			return;
		}
		commitVisible(withoutPort(graph, nodeId, direction, portId));
	}

	function addNode() {
		const node = createNode(graph);
		commitVisible({ ...graph, nodes: [...graph.nodes, node] });
		selectNode(node.id);
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
		const ids = selectedEdgeIds.includes(id) ? selectedEdgeIds : [id];
		commitVisible({ ...graph, edges: graph.edges.filter((edge) => !ids.includes(edge.id)) });
		rememberSelection(selectedNodeIds, []);
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
			rememberSelection([], []);
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
		const next = withEdgePatch(graph, selectedEdge, patch);
		if (!next) {
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
		pointerMoved = false;
		nodeDrag = {
			nodeId,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			originX: start.x,
			originY: start.y
		};
		if (diagramMode === 'graph') reheat(0.4);
		event.stopPropagation();
	}

	function moveNodeDrag(event: PointerEvent) {
		if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) return;
		const dx = event.clientX - nodeDrag.x;
		const dy = event.clientY - nodeDrag.y;
		if (Math.abs(dx) + Math.abs(dy) > 3) pointerMoved = true;
		overrides = {
			...overrides,
			[nodeDrag.nodeId]: {
				x: nodeDrag.originX + dx / zoom,
				y: nodeDrag.originY + dy / zoom
			}
		};
	}

	function stopNodeDrag(event: PointerEvent) {
		if (nodeDrag?.pointerId === event.pointerId) nodeDrag = null;
	}

	function fitView(animate = false) {
		fitPoints(
			basePositions,
			visibleNodes.map((node) => node.id),
			animate
		);
	}

	function reheat(amount = 0.7) {
		simAlpha = Math.max(simAlpha, amount);
		ensureSim();
	}

	function ensureSim() {
		if (settleHandle || diagramMode !== 'graph') return;
		const step = () => {
			if (diagramMode !== 'graph') {
				settleHandle = 0;
				return;
			}
			const target = forces.animate ? 0.06 : 0;
			simAlpha += (target - simAlpha) * 0.02;
			if (!forces.animate && simAlpha < 0.02) {
				simAlpha = 0;
				settleHandle = 0;
				if (fitWhenCool) {
					fitWhenCool = false;
					void tick()
						.then(() => fitView(true))
						.catch(() => undefined);
				}
				return;
			}
			const next = forceStep(
				graph,
				overrides,
				settleVelocity,
				forces,
				simAlpha,
				nodeDrag?.nodeId ?? null
			);
			overrides = next.positions;
			settleVelocity = next.velocity;
			settleHandle = requestAnimationFrame(step);
		};
		settleHandle = requestAnimationFrame(step);
	}

	function startSettle() {
		const fromFlow = diagramMode !== 'graph';
		const seed: Record<string, Point> = {};
		for (const node of graph.nodes) {
			const point = basePositions[node.id] ?? { x: 0, y: 0 };
			seed[node.id] = fromFlow
				? { x: point.x + flowCard.width / 2, y: point.y + flowCard.height / 2 }
				: point;
		}
		stopSettle();
		diagramMode = 'graph';
		overrides = seed;
		settleVelocity = {};
		simAlpha = 1;
		fitWhenCool = fromFlow;
		ensureSim();
	}

	function setForces(patch: Partial<typeof forces>) {
		forces = { ...forces, ...patch };
		if (diagramMode === 'graph') reheat(patch.layout ? 1 : 0.7);
	}

	function onKeydown(event: KeyboardEvent) {
		const tag = (event.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (event.key === 'Escape') {
			if (filtersOpen) {
				filtersOpen = false;
				return;
			}
			if (armedOutput) {
				armedOutput = null;
				return;
			}
			rememberSelection([], []);
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeIds.length > 0) {
			event.preventDefault();
			disconnectEdge(selectedEdgeIds[0]);
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
		if (target.closest('[data-interactive], .node, .dot, .edge-hit')) return;
		viewport?.setPointerCapture(event.pointerId);
		marqueeDrag = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			shift: event.shiftKey
		};
	}

	function moveMarquee(event: PointerEvent) {
		if (!marqueeDrag || marqueeDrag.pointerId !== event.pointerId || !viewport) return;
		const bounds = viewport.getBoundingClientRect();
		const start = { x: marqueeDrag.x - bounds.left, y: marqueeDrag.y - bounds.top };
		const end = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
		const rect = worldRect(start, end);
		marquee = { ...rect, mode: marqueeMode(start.x, end.x) };
	}

	function finishMarquee(event: PointerEvent) {
		if (!marqueeDrag || marqueeDrag.pointerId !== event.pointerId) return;
		const drag = marqueeDrag;
		const box = marquee;
		marqueeDrag = null;
		marquee = null;
		if (!box || box.width + box.height < 4) {
			if (!drag.shift) rememberSelection([], []);
			return;
		}
		const rect = {
			x: (box.x - pan.x) / zoom,
			y: (box.y - pan.y) / zoom,
			width: box.width / zoom,
			height: box.height / zoom
		};
		const nodeIds = visibleNodes
			.filter((node) => {
				const point = basePositions[node.id];
				if (!point) return false;
				if (diagramMode === 'graph') {
					return hitByMarquee(
						{ id: node.id, kind: 'circle', x: point.x, y: point.y, radius: nodeRadius(node.id) },
						rect,
						box.mode
					);
				}
				return hitByMarquee(
					{
						id: node.id,
						kind: 'box',
						x: point.x,
						y: point.y,
						width: flowCard.width,
						height: flowCard.height
					},
					rect,
					box.mode
				);
			})
			.map((node) => node.id);
		const edgeIds = visibleEdges
			.filter((edge) => {
				const route = routes.find((item) => item.id === edge.id);
				if (!route) return false;
				return hitByMarquee({ id: edge.id, kind: 'line', points: route.points }, rect, box.mode);
			})
			.map((edge) => edge.id);
		rememberSelection(
			drag.shift ? [...new Set([...selectedNodeIds, ...nodeIds])] : nodeIds,
			drag.shift ? [...new Set([...selectedEdgeIds, ...edgeIds])] : edgeIds
		);
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
				onclick={showFlow}>Flow</Button
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
				<div class="filter-wrap">
					<button
						type="button"
						class="filter-toggle"
						aria-expanded={filtersOpen}
						aria-controls="tag-filter-menu"
						onclick={() => (filtersOpen = !filtersOpen)}
					>
						<span>Filter{activeTags.length ? ` (${activeTags.length})` : ''}</span>
						<span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
					</button>
					{#if filtersOpen}
						<button
							type="button"
							class="filter-backdrop"
							aria-label="Close filters"
							onclick={() => (filtersOpen = false)}
						></button>
						<div id="tag-filter-menu" class="filter-menu" role="dialog" aria-label="Tag filters">
							<Input aria-label="Filter tags" placeholder="Filter tags…" bind:value={tagQuery} />
							<div class="sort-row" role="group" aria-label="Sort tags">
								<span>Sort</span>
								<button
									type="button"
									aria-pressed={tagSort === 'name'}
									onclick={() => (tagSort = 'name')}>Name</button
								>
								<button
									type="button"
									aria-pressed={tagSort === 'count'}
									onclick={() => (tagSort = 'count')}>Count</button
								>
							</div>
							<p class="help">A group matches any selected tag. Every group must match.</p>
							{#if visibleTagGroups.length === 0}
								<p class="help">No tags match.</p>
							{/if}
							{#each visibleTagGroups as [group, tags] (group)}
								<strong>{group}</strong>
								{#each tags as tag (tag)}
									<label class="tag-check">
										<input
											type="checkbox"
											checked={activeTags.includes(tag)}
											onchange={() => toggleTag(tag)}
										/>
										{tagLabel(tag)}
										<span class="count">{tagCount(tag)}</span>
									</label>
								{/each}
							{/each}
							{#if activeTags.length}
								<button type="button" class="clear-filters" onclick={() => (activeTags = [])}
									>Clear</button
								>
							{/if}
						</div>
					{/if}
				</div>
				{#if activeTags.length}
					<div class="active-tags">
						{#each activeTags as tag (tag)}
							<button type="button" onclick={() => toggleTag(tag)}>{tagLabel(tag)} ×</button>
						{/each}
					</div>
				{/if}
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
				<p class="help">
					Middle-click to pan. Drag left to right to enclose, or right to left to cross. In Graph,
					nodes are dots.
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
					moveMarquee(event);
				}}
				onpointerup={(event) => {
					stopNodeDrag(event);
					stopPan(event);
					finishMarquee(event);
				}}
				onpointercancel={(event) => {
					stopNodeDrag(event);
					stopPan(event);
					marqueeDrag = null;
					marquee = null;
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
								class:selected={selectedNodeIds.includes(node.id)}
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
					<svg
						class="edges"
						class:dots={diagramMode === 'graph'}
						viewBox="0 0 2400 1800"
						style={`--link: ${forces.linkThickness / 100}`}
						aria-hidden="true"
					>
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
									class:hot={highlightedEdgeIds.has(edge.id) || selectedEdgeIds.includes(edge.id)}
									class:dim={emphasize && !highlightedEdgeIds.has(edge.id)}
									marker-end={diagramMode === 'flow' ? 'url(#arrow)' : undefined}
								></path>
								<path
									d={route.d}
									class="edge-hit"
									role="button"
									tabindex="0"
									aria-label={route.label}
									onclick={(event) => selectEdge(edge.id, event.shiftKey)}
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
						{#if diagramMode === 'graph'}
							<article
								class="dot"
								class:hot={highlightedNodeIds.has(node.id)}
								class:selected={selectedNodeIds.includes(node.id)}
								class:dim={emphasize && !highlightedNodeIds.has(node.id)}
								style={`left: ${basePositions[node.id]?.x ?? 0}px; top: ${basePositions[node.id]?.y ?? 0}px; --r: ${nodeRadius(node.id) * (forces.nodeSize / 100)}px; --dot: ${dotColor(node)};`}
							>
								<button
									type="button"
									class="dot-hit"
									title={node.subtitle || node.label}
									onpointerenter={() => (hoveredNodeId = node.id)}
									onpointerleave={() => {
										if (hoveredNodeId === node.id) hoveredNodeId = null;
									}}
									onpointerdown={(event) => {
										if (event.button !== 0) return;
										startNodeDrag(event, node.id);
									}}
									onclick={(event) => selectNode(node.id, true, event.shiftKey)}
								>
									<span class="dot-mark" aria-hidden="true"></span>
									<span class="dot-label">{node.label}</span>
								</button>
							</article>
						{:else}
							<article
								class="node"
								class:hot={highlightedNodeIds.has(node.id)}
								class:selected={selectedNodeIds.includes(node.id)}
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
										onclick={(event) => selectNode(node.id, false, event.shiftKey)}
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
										<button
											type="button"
											class="port in"
											data-interactive
											onclick={() => connectTo(node.id, port.id)}
										>
											<span class="socket"></span><span class="port-label">{port.label}</span>
										</button>
									{/each}
								</div>
								<div class="port-side outputs">
									{#each node.outputs as port (port.id)}
										<button
											type="button"
											class="port out"
											class:active={armedOutput?.nodeId === node.id &&
												armedOutput?.portId === port.id}
											data-interactive
											onclick={() => (armedOutput = { nodeId: node.id, portId: port.id })}
										>
											<span class="socket"></span><span class="port-label">{port.label}</span>
										</button>
									{/each}
								</div>
							</article>
						{/if}
					{/each}
				</div>
				{#if marquee}
					<div
						class="marquee {marquee.mode}"
						style={`left:${marquee.x}px;top:${marquee.y}px;width:${marquee.width}px;height:${marquee.height}px`}
					></div>
				{/if}
				{#if diagramMode === 'graph'}
					<div class="forces" data-interactive>
						<p>Layout</p>
						<div class="force-layouts">
							<button
								type="button"
								aria-pressed={forces.layout === 'web'}
								onclick={() => setForces({ layout: 'web' })}>Web</button
							>
							<button
								type="button"
								aria-pressed={forces.layout === 'radial'}
								onclick={() => setForces({ layout: 'radial' })}>Globe</button
							>
							<button
								type="button"
								aria-pressed={forces.layout === 'layered'}
								onclick={() => setForces({ layout: 'layered' })}>Layers</button
							>
						</div>
						<label
							>Center <input
								aria-label="Center"
								type="range"
								min="0"
								max="100"
								value={forces.center}
								oninput={(event) => setForces({ center: Number(event.currentTarget.value) })}
							/></label
						>
						<label
							>Repel <input
								aria-label="Repel"
								type="range"
								min="0"
								max="100"
								value={forces.repel}
								oninput={(event) => setForces({ repel: Number(event.currentTarget.value) })}
							/></label
						>
						<label
							>Link <input
								aria-label="Link"
								type="range"
								min="0"
								max="100"
								value={forces.link}
								oninput={(event) => setForces({ link: Number(event.currentTarget.value) })}
							/></label
						>
						<label
							>Link distance <input
								aria-label="Link distance"
								type="range"
								min="80"
								max="260"
								value={forces.linkDistance}
								oninput={(event) => setForces({ linkDistance: Number(event.currentTarget.value) })}
							/><span>{forces.linkDistance}px</span></label
						>
						<label
							>Node size <input
								aria-label="Node size"
								type="range"
								min="70"
								max="145"
								value={forces.nodeSize}
								oninput={(event) => setForces({ nodeSize: Number(event.currentTarget.value) })}
							/></label
						>
						<label
							>Link thickness <input
								aria-label="Link thickness"
								type="range"
								min="60"
								max="240"
								value={forces.linkThickness}
								oninput={(event) => setForces({ linkThickness: Number(event.currentTarget.value) })}
							/></label
						>
						<div class="force-actions">
							<button
								type="button"
								aria-pressed={forces.animate}
								onclick={() => setForces({ animate: !forces.animate })}
								>{forces.animate ? 'Pause' : 'Animate'}</button
							>
							<button type="button" onclick={() => reheat(1)}>Reheat</button>
						</div>
					</div>
				{/if}
				<div class="floating">
					<Button size="sm" variant="default" aria-pressed="true">Select</Button>
					<Button size="sm" variant="outline" onclick={() => fitView(true)}>Fit</Button>
					<Button size="sm" variant="outline" onclick={startSettle}>Settle</Button>
					{#if armedOutput}
						<Button size="sm" variant="outline" onclick={() => (armedOutput = null)}>Cancel</Button>
					{/if}
				</div>
				<div class="status">
					{diagramMode === 'flow' ? 'Flow' : 'Graph'} · {selectedNodeIds.length > 1
						? `${selectedNodeIds.length} selected`
						: selectedNode
							? selectedNode.label
							: selectedEdgeIds.length > 1
								? `${selectedEdgeIds.length} connections`
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
			{#if visibleEdges.length && diagramMode === 'flow'}
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
						References {inventoryCount(defaultInventory, 'reference')} · Repos {inventoryCount(
							defaultInventory,
							'repo'
						)} · Domains {inventoryCount(defaultInventory, 'domain')} · Hosts {inventoryCount(
							defaultInventory,
							'hostname'
						)} · Convex {inventoryCount(defaultInventory, 'convex')}. Private records are not in
						this public app.
					</p>
					<select
						class="theme-select"
						aria-label="Inventory type"
						value={inventoryKind}
						onchange={(event) => {
							const value = parseInventoryFilter(event.currentTarget.value);
							if (value) inventoryKind = value;
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
			{:else if selectedNodeIds.length > 1}
				<div class="panel">
					<h2>{selectedNodeIds.length} nodes selected</h2>
					<p class="help">
						Drag left to right selects only what is fully inside. Drag right to left also selects
						what the box touches.
					</p>
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
