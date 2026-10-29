<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { Tabs } from 'bits-ui';
	import { SvelteMap } from 'svelte/reactivity';
	import { asset, resolve } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
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
		validateGraph,
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
	} from './core';
	import type {
		ArchitectureEdge,
		ArchitectureGraph,
		ArchitectureNode,
		ArchitecturePort,
		DiagramMode,
		FlowDirection,
		NodeView,
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
		withoutPort,
		withoutNodes
	} from './lib/edit';
	import { dotColor, facetChips, filterTagGroups, tagLabel } from './lib/present';
	import { panForZoom, wheelGesture } from './lib/camera';
	import { rememberSnapshot } from './lib/history';
	import { createNodeView, kindGroups, mermaidSource, convertNodeView } from './lib/diagram-views';
	import { hitByMarquee, marqueeMode, worldRect, type MarqueeMode } from './lib/select';
	import {
		createDocument,
		isJsonValue,
		documentAsJson,
		documentAsMarkdown,
		parseDiagramDocument,
		parseDiagramMarkdown,
		MAX_DOCUMENT_INPUT_CHARS,
		type DiagramDocument
	} from './lib/document';
	import { importN8nWorkflow, exportN8nWorkflow } from './lib/n8n';
	import './editor.css';
	import { themePreference } from '$lib/theme.svelte';

	let root = $state<ArchitectureGraph>(cloneGraph(defaultGraph));
	let importedDocument = $state<DiagramDocument>({
		...createDocument(defaultGraph),
		inventory: defaultInventory
	});
	let layouts = $state<Record<string, Record<string, Point>>>({});
	let documentRevision = $state(0);
	let cameraGeneration = 0;
	let skipImportedFit = false;
	let skipSelectionFit = false;
	let exportFormat = $state<'json' | 'md' | 'n8n' | 'n8n-inactive'>('json');
	let inputFormat = $state<'json' | 'md'>('json');
	const inventory = $derived(importedDocument.inventory ?? defaultInventory);
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
			flowDirection = view.flowDirection;
			traceMode = view.trace;
			focusMode = view.focus;
			selectedNodeIds = [
				...new Set(view.seeds.filter((id) => graph.nodes.some((node) => node.id === id)))
			];
			selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
		} catch {
			actionMessage = 'This shared graph link is invalid or too large. The default graph is shown.';
		}
		jsonText = JSON.stringify(diagramAt(root, diagramPath) ?? root, null, 2);
		hydrated = true;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => {
			reducedMotion = motion.matches;
			if (reducedMotion) {
				stopSettle();
				forces = { ...forces, animate: false };
			}
		};
		updateMotion();
		motion.addEventListener('change', updateMotion);
		let lastSize = !window.matchMedia('(max-width: 64rem)').matches
			? viewport?.getBoundingClientRect()
			: undefined;
		const resize = new ResizeObserver(() => {
			const nextSize = viewport?.getBoundingClientRect();
			const desktop = !window.matchMedia('(max-width: 64rem)').matches;
			if (
				lastSize &&
				nextSize &&
				lastSize.width > 40 &&
				lastSize.height > 40 &&
				nextSize.width > 40 &&
				nextSize.height > 40 &&
				desktop &&
				!activeView
			) {
				const dx = (nextSize.width - lastSize.width) / 2;
				const dy = (nextSize.height - lastSize.height) / 2;
				if (dx || dy) panBy(dx, dy);
			}
			lastSize = desktop ? nextSize : undefined;
		});
		if (viewport) resize.observe(viewport);
		return () => {
			motion.removeEventListener('change', updateMotion);
			resize.disconnect();
		};
	});

	let diagramMode = $state<DiagramMode>('flow');
	let flowDirection = $state<FlowDirection>('LR');
	let diagramPreview = $state<NodeView | null>(null);
	let pickerOpen = $state(false);
	let pickerIndex = $state(0);
	let pickerTrigger = $state<HTMLButtonElement | null>(null);
	let pickerList = $state<HTMLDivElement | null>(null);
	let pickerWrapper = $state<HTMLDivElement | null>(null);
	let openView = $state<{ nodeId: string; viewId: string } | null>(null);
	let viewHost = $state<HTMLDivElement | null>(null);
	let viewError = $state('');
	let viewPanel = $state<HTMLDivElement | null>(null);
	let viewReturnFocus: HTMLElement | null = null;
	let traceMode = $state<TraceMode>('direct');
	let focusMode = $state(false);
	let search = $state('');
	let tagQuery = $state('');
	let tagSort = $state<'name' | 'count'>('name');
	let filtersOpen = $state(false);
	let filterTrigger = $state<HTMLButtonElement | null>(null);
	let filterMenu = $state<HTMLDivElement | null>(null);
	let mobileCanvas = $state(false);
	let canvasTool = $state<'select' | 'pan'>('select');
	let explorerCollapsed = $state(false);
	let inspectorCollapsed = $state(false);
	let spaceHeld = $state(false);
	let reducedMotion = $state(false);
	let suppressCanvasClick = false;
	const touchPoints = new SvelteMap<number, Point>();
	let touchPinch: { distance: number; center: Point; pan: Point; zoom: number } | null = null;
	let mobileForces = $state(false);
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
	let sourceDraftDirty = $state(false);
	let contentRevision = $state(0);
	let sourceRevision = $state(0);
	let connectionMessage = $state('');
	let actionMessage = $state('');
	let undoStack = $state<string[]>([]);
	let redoStack = $state<string[]>([]);
	let hasUnsavedEdits = $state(false);
	beforeNavigate((navigation) => {
		if ((!hasUnsavedEdits && !sourceDraftDirty) || navigation.type === 'leave') return;
		const from = navigation.from?.url;
		const to = navigation.to?.url;
		if (
			from &&
			to &&
			from.origin === to.origin &&
			from.pathname === to.pathname &&
			from.search === to.search
		)
			return;
		if (
			!window.confirm(
				'Leave this editor? Unsaved changes and local undo history will be lost. Export a document to keep your work.'
			)
		)
			navigation.cancel();
	});
	let zoom = $state(0.72);
	const overview = $derived(zoom < 0.75);
	let pan = $state({ x: 32, y: 28 });
	let overrides = $state<Record<string, Point>>({});
	const editorTheme = $derived(
		themePreference.preference === 'system'
			? 'system'
			: themePreference.preference === 'dark'
				? 'composio-dark'
				: 'composio-light'
	);
	const appliedTheme = $derived(
		themePreference.theme === 'dark' ? 'composio-dark' : 'composio-light'
	);
	let inspectorTab = $state<'details' | 'inventory' | 'json'>('details');
	let nodeDrag = $state<{
		nodeId: string;
		pointerId: number;
		x: number;
		y: number;
		originX: number;
		originY: number;
		armed: boolean;
	} | null>(null);
	let pointerMoved = false;
	let panStart = $state<{
		pointerId: number;
		x: number;
		y: number;
		panX: number;
		panY: number;
		nodeId?: string;
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

	onDestroy(() => {
		stopSettle();
	});

	function applyEditorTheme(next: 'composio-dark' | 'composio-light' | 'system') {
		themePreference.setTheme(
			next === 'system' ? 'system' : next === 'composio-dark' ? 'dark' : 'light'
		);
	}

	const positions = $derived(layoutGraph(graph, diagramMode, flowDirection));
	const basePositions = $derived(
		Object.fromEntries(
			graph.nodes.map((node) => [
				node.id,
				(Object.hasOwn(overrides, node.id) ? overrides[node.id] : undefined) ??
					positions[node.id] ?? { x: 0, y: 0 }
			])
		)
	);
	const selectionTrace = $derived(traceGraph(graph, selectedNodeIds, traceMode));
	const focusedNodeIds = $derived(new Set(selectionTrace.nodeIds));
	const traceSeeds = $derived(hoveredNodeId ? [hoveredNodeId] : selectedNodeIds);
	const trace = $derived(
		hoveredNodeId ? traceGraph(graph, [hoveredNodeId], traceMode) : selectionTrace
	);
	const highlightedNodeIds = $derived(new Set(trace.nodeIds));
	const highlightedEdgeIds = $derived(new Set(trace.edgeIds));
	const selectedNode = $derived(graph.nodes.find((node) => node.id === selectedNodeId));
	const activeView = $derived.by(() => {
		if (diagramPreview) return diagramPreview;
		const opened = openView;
		if (!opened) return null;
		const node = graph.nodes.find((item) => item.id === opened.nodeId);
		return node?.views?.find((view) => view.id === opened.viewId) ?? null;
	});
	const diagramKindGroups = kindGroups();
	const pickerKinds = diagramKindGroups.flatMap((group) => group.kinds);
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
			inventory,
			inventorySearch,
			[],
			inventoryKind === 'all' ? undefined : inventoryKind
		)
	);
	const worldStyle = $derived(
		`transform: translate(${pan.x}px, ${pan.y}px) scale(${zoom}); --camera-scale: ${zoom};`
	);

	function nodeMatches(node: ArchitectureNode) {
		const needle = search.trim().toLowerCase();
		const searchMatch =
			!needle ||
			[node.label, node.subtitle ?? '', ...node.tags].join(' ').toLowerCase().includes(needle);
		const tagMatch = tagsMatchFacets(node.tags, activeTags);
		const focusMatch = !focusMode || selectedNodeIds.length === 0 || focusedNodeIds.has(node.id);
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
	const routes = $derived(routeEdges(graph, basePositions, diagramMode, flowDirection));
	const emphasize = $derived(traceSeeds.length > 0 && highlightedNodeIds.size > 1);
	const fitKey = $derived(
		`${JSON.stringify(selectedNodeIds)}:${flowDirection}:${diagramPath.join('/')}:${graph.nodes.map((node) => `${node.id}@${node.level ?? 3}`).join('|')}:${visibleNodes
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

	function fitPoints(
		points: Record<string, Point>,
		ids: string[],
		animate = false,
		includeRoutes = true
	) {
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
		if (includeRoutes) {
			for (const route of routes) {
				if (!visibleEdges.some((edge) => edge.id === route.id)) continue;
				for (const point of route.points) {
					minX = Math.min(minX, point.x - 12);
					minY = Math.min(minY, point.y - 18);
					maxX = Math.max(maxX, point.x + 12);
					maxY = Math.max(maxY, point.y + 8);
				}
			}
		}
		const rect = viewport.getBoundingClientRect();
		if (rect.width < 40 || rect.height < 40) return;
		const pad = 28;
		const navigation = viewport.querySelector<HTMLElement>('.canvas-navigation');
		const toolbar = viewport.querySelector<HTMLElement>('.toolbar');
		const topInset = Math.max(
			pad,
			navigation && navigation.getClientRects().length
				? navigation.getBoundingClientRect().bottom - rect.top + 12
				: 0
		);
		const bottomInset = Math.max(
			pad,
			toolbar && toolbar.getClientRects().length
				? rect.bottom - toolbar.getBoundingClientRect().top + 12
				: 0
		);
		const availableHeight = Math.max(24, rect.height - topInset - bottomInset);
		const cap = includeRoutes ? 1.25 : 2.2;
		const scale = Math.min(
			cap,
			Math.max(
				0.08,
				Math.min((rect.width - pad * 2) / (maxX - minX), availableHeight / (maxY - minY))
			)
		);
		const nextPan = {
			x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
			y: topInset + (availableHeight - (maxY - minY) * scale) / 2 - minY * scale
		};
		if (!animate || reducedMotion) {
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
		openView = null;
		diagramPreview = null;
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
		const to = layoutGraph(graph, 'flow', flowDirection);
		const cameraAtStart = cameraGeneration;
		if (reducedMotion) {
			overrides = {};
			void tick()
				.then(() => fitView())
				.catch(() => undefined);
			return;
		}
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
				.then(() => {
					if (cameraAtStart === cameraGeneration) fitView(true);
				})
				.catch(() => undefined);
		};
		settleHandle = requestAnimationFrame(step);
	}

	$effect(() => {
		if (!hydrated) return;
		const key = fitKey;
		void documentRevision;
		const generation = cameraGeneration;
		if (skipImportedFit || skipSelectionFit) {
			skipImportedFit = false;
			skipSelectionFit = false;
			return;
		}
		const ids = untrack(() => visibleNodes.map((node) => node.id));
		void key;
		void tick()
			.then(() => {
				if (generation === cameraGeneration)
					fitPoints(
						untrack(() => basePositions),
						ids
					);
			})
			.catch(() => undefined);
	});

	function recordHistory(): boolean {
		try {
			undoStack = rememberSnapshot(undoStack, documentAsJson(documentSnapshot()));
			redoStack = [];
			hasUnsavedEdits = true;
			contentRevision += 1;
			return true;
		} catch (error) {
			actionMessage =
				error instanceof Error
					? error.message
					: 'Could not preserve the previous document. The edit was not applied.';
			return false;
		}
	}

	function travelHistory(direction: 'undo' | 'redo') {
		if (!confirmDraftReplacement()) return;
		const stack = direction === 'undo' ? undoStack : redoStack;
		const previous = stack.at(-1);
		if (!previous) return;
		try {
			const current = documentAsJson(documentSnapshot());
			applyImported(parseDiagramDocument(previous), false);
			if (direction === 'undo') {
				undoStack = stack.slice(0, -1);
				redoStack = rememberSnapshot(redoStack, current);
			} else {
				redoStack = stack.slice(0, -1);
				undoStack = rememberSnapshot(undoStack, current);
			}
			hasUnsavedEdits = true;
			actionMessage = direction === 'undo' ? 'Change undone.' : 'Change redone.';
		} catch (error) {
			actionMessage =
				error instanceof Error
					? error.message
					: 'Could not restore history. The current document is unchanged.';
		}
	}

	function commitVisible(next: ArchitectureGraph): boolean {
		const updated = writeDiagram(root, diagramPath, next);
		if (updated === root) {
			jsonMessage = `This graph change is invalid or exceeds ${MAX_DIAGRAM_DEPTH} component levels. The current map is unchanged.`;
			actionMessage = jsonMessage;
			return false;
		}
		if (!recordHistory()) return false;
		root = updated;
		selectedNodeIds = selectedNodeIds.filter((id) => next.nodes.some((node) => node.id === id));
		selectedEdgeIds = selectedEdgeIds.filter((id) => next.edges.some((edge) => edge.id === id));
		selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
		selectedEdgeId =
			selectedNodeIds.length === 0 && selectedEdgeIds.length === 1 ? selectedEdgeIds[0] : null;
		if (
			armedOutput &&
			!next.nodes.some(
				(node) =>
					node.id === armedOutput?.nodeId &&
					node.outputs.some((port) => port.id === armedOutput?.portId)
			)
		)
			armedOutput = null;
		if (
			openView &&
			!next.nodes.some(
				(node) =>
					node.id === openView?.nodeId && node.views?.some((view) => view.id === openView?.viewId)
			)
		) {
			openView = null;
			diagramPreview = null;
			viewError = '';
		}
		return true;
	}

	function resetLevel() {
		stopSettle();
		selectedNodeId = null;
		selectedNodeIds = [];
		selectedEdgeId = null;
		selectedEdgeIds = [];
		armedOutput = null;
		overrides = layouts[JSON.stringify(diagramPath)] ?? {};
		openView = null;
		diagramPreview = null;
		search = '';
		activeTags = [];
		focusMode = false;
	}

	function showDiagram(depth: number) {
		if (!confirmDraftReplacement()) return;
		const nextPath = diagramPath.slice(0, depth);
		layouts = { ...layouts, [JSON.stringify(diagramPath)]: overrides };
		diagramPath = nextPath;
		resetLevel();
		syncJson(true);
	}

	function openDiagram(id: string) {
		const visible = diagramAt(root, diagramPath) ?? root;
		const node = visible.nodes.find((item) => item.id === id);
		if (!node?.child || !confirmDraftReplacement()) return;
		layouts = { ...layouts, [JSON.stringify(diagramPath)]: overrides };
		diagramPath = [...diagramPath, id];
		resetLevel();
		syncJson(true);
	}

	function addComponentDiagram(id: string) {
		const node = graph.nodes.find((item) => item.id === id);
		if (!node || node.child || diagramPath.length >= MAX_DIAGRAM_DEPTH) return;
		const applied = commitVisible({
			...graph,
			nodes: graph.nodes.map((item) =>
				item.id === id ? { ...item, child: blankChild(item.label) } : item
			)
		});
		if (applied) openDiagram(id);
	}

	function rememberSelection(nodeIds: string[], edgeIds: string[]) {
		cameraGeneration += 1;
		if (JSON.stringify(nodeIds) !== JSON.stringify(selectedNodeIds)) skipSelectionFit = true;
		fitWhenCool = false;
		stopMotion();
		connectionMessage = '';
		if (diagramPreview) {
			diagramPreview = null;
			viewError = '';
		}
		selectedNodeIds = nodeIds;
		selectedEdgeIds = edgeIds;
		selectedNodeId = nodeIds.length === 1 ? nodeIds[0] : null;
		selectedEdgeId = nodeIds.length === 0 && edgeIds.length === 1 ? edgeIds[0] : null;
		if (openView && openView.nodeId !== selectedNodeId) {
			openView = null;
			diagramPreview = null;
			viewError = '';
		}
		if (nodeIds.length === 1 || edgeIds.length === 1) {
			inspectorTab = 'details';
			inspectorCollapsed = false;
		}
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

	function removeSelectedNodes() {
		const ids = selectedNodeIds.filter((id) => graph.nodes.some((node) => node.id === id));
		if (ids.length === 0) return;
		if (
			!confirm(
				`Remove ${ids.length === 1 ? 'this node' : `${ids.length} selected nodes`} and its component diagrams and views? Connections to the removed nodes will also be removed.`
			)
		)
			return;
		const removed = new Set(ids);
		const next = withoutNodes(graph, ids);
		if (
			!commitVisible({
				...next,
				edges: next.edges.filter((edge) => !selectedEdgeIds.includes(edge.id))
			})
		)
			return;
		overrides = Object.fromEntries(Object.entries(overrides).filter(([id]) => !removed.has(id)));
		layouts = Object.fromEntries(
			Object.entries(layouts).filter(([key]) => {
				try {
					const path: unknown = JSON.parse(key);
					return !(
						Array.isArray(path) &&
						diagramPath.every((id, index) => path[index] === id) &&
						removed.has(path[diagramPath.length])
					);
				} catch {
					return true;
				}
			})
		);
		rememberSelection([], []);
		actionMessage =
			ids.length === 1
				? 'Node removed with its diagrams and connections.'
				: `${ids.length} nodes removed with their diagrams and connections.`;
		jsonMessage = actionMessage;
		focusAfterChange('canvas');
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
		actionMessage = jsonMessage;
	}

	function disconnectEdge(id: string) {
		const ids = selectedEdgeIds.includes(id) ? selectedEdgeIds : [id];
		commitVisible({ ...graph, edges: graph.edges.filter((edge) => !ids.includes(edge.id)) });
		rememberSelection(selectedNodeIds, []);
		actionMessage = `${ids.length} connection${ids.length === 1 ? '' : 's'} removed. Undo can restore them.`;
		focusAfterChange('canvas');
	}

	function focusAfterChange(kind: 'node' | 'canvas' | 'view-picker') {
		const previous = document.activeElement;
		void tick()
			.then(() => {
				if (kind === 'node') {
					(document.getElementById('selected-node-label') ?? viewport)?.focus({
						preventScroll: true
					});
				} else if (kind === 'view-picker') {
					document.querySelector<HTMLButtonElement>('button[aria-label="Diagram type"]')?.focus();
				} else if (!previous?.isConnected || document.activeElement === document.body) {
					viewport?.focus();
				}
			})
			.catch(() => undefined);
	}

	function openNodeView(nodeId: string, viewId: string, opener?: HTMLElement) {
		diagramPreview = null;
		pickerOpen = false;
		stopSettle();
		viewReturnFocus =
			opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
		openView = { nodeId, viewId };
		viewError = '';
		void tick()
			.then(() => {
				if (openView?.nodeId === nodeId && openView.viewId === viewId)
					viewPanel?.querySelector<HTMLButtonElement>('.view-bar button')?.focus();
			})
			.catch(() => undefined);
	}

	function closeNodeView() {
		openView = null;
		diagramPreview = null;
		void tick()
			.then(() => {
				const target =
					viewReturnFocus?.isConnected && viewReturnFocus.getClientRects().length
						? viewReturnFocus
						: viewport;
				target?.focus();
			})
			.catch(() => undefined);
	}

	function materialize(id: string) {
		const item = inventory.find((candidate) => candidate.id === id);
		if (!item) return;
		const existing = graph.nodes.find(
			(node) =>
				node.id === item.id ||
				(item.kind !== undefined &&
					node.inventoryRef?.kind === item.kind &&
					node.inventoryRef.key === item.id)
		);
		if (existing) {
			rememberSelection([existing.id], []);
			inspectorTab = 'details';
			focusAfterChange('node');
			return;
		}
		if (!commitVisible(addInventoryItem(graph, item))) return;
		rememberSelection([item.id], []);
		focusAfterChange('node');
	}

	function confirmDraftReplacement(): boolean {
		if (!sourceDraftDirty) return true;
		if (window.confirm('Replace the unapplied source draft? Copy it first to keep it.'))
			return true;
		jsonMessage = 'Cancelled. The unapplied source draft is unchanged.';
		return false;
	}

	function confirmStaleSource(): boolean {
		if (sourceRevision === contentRevision) return true;
		if (
			window.confirm(
				'The canvas changed after this source was captured. Apply the older source and replace those edits? Undo remains available.'
			)
		)
			return true;
		jsonMessage = 'Apply cancelled. Newer canvas edits and the source are unchanged.';
		return false;
	}

	function syncJson(force = false) {
		if (!force && !confirmDraftReplacement()) return;
		try {
			jsonText =
				inputFormat === 'md'
					? documentAsMarkdown(documentSnapshot())
					: documentAsJson(documentSnapshot());
			sourceDraftDirty = false;
			sourceRevision = contentRevision;
			jsonMessage = 'The editor contains the complete document.';
		} catch (error) {
			jsonMessage = error instanceof Error ? error.message : 'Could not serialize document.';
		}
	}

	function documentSnapshot(): DiagramDocument {
		return {
			...importedDocument,
			graph: root,
			ui: {
				...importedDocument.ui,
				themePreset: editorTheme,
				diagramMode,
				...(flowDirection !== 'LR' || importedDocument.ui?.flowDirection !== undefined
					? { flowDirection }
					: {}),
				traceMode,
				focusMode,
				query: search,
				tags: activeTags,
				seeds: selectedNodeIds,
				open: diagramPath,
				pan,
				zoom,
				positions: overrides,
				layouts: { ...layouts, [JSON.stringify(diagramPath)]: overrides }
			}
		};
	}

	function exportJson() {
		try {
			const snapshot = documentSnapshot();
			const text =
				exportFormat === 'md'
					? documentAsMarkdown(snapshot)
					: exportFormat === 'n8n' || exportFormat === 'n8n-inactive'
						? exportN8nWorkflow(snapshot, {
								mode: exportFormat === 'n8n-inactive' ? 'inactive' : 'preserve'
							})
						: documentAsJson(snapshot);
			const markdown = exportFormat === 'md';
			const file = new Blob([text], {
				type: markdown ? 'text/markdown;charset=utf-8' : 'application/json'
			});
			const href = URL.createObjectURL(file);
			const link = document.createElement('a');
			link.href = href;
			link.download = exportFormat.startsWith('n8n')
				? 'manef-workflow.json'
				: `manef-architecture.${markdown ? 'md' : 'json'}`;
			link.click();
			URL.revokeObjectURL(href);
			if (!exportFormat.startsWith('n8n')) hasUnsavedEdits = false;
			actionMessage = exportFormat.startsWith('n8n')
				? 'Downloaded the preserved n8n workflow. Review parameters and credential references before importing it.'
				: 'Downloaded the complete document, including nested diagrams, view sources, metadata and layout.';
		} catch (error) {
			actionMessage = error instanceof Error ? error.message : 'Export failed.';
		}
		jsonMessage = actionMessage;
	}

	function applyImported(next: DiagramDocument, remember = true) {
		// Validation and cloning finish before any current editor state changes.
		const validated = parseDiagramDocument(documentAsJson(next));
		const editorText =
			inputFormat === 'md' ? documentAsMarkdown(validated) : documentAsJson(validated);
		const opened = validated.ui?.open ?? [];
		const importedGraph = diagramAt(validated.graph, opened);
		if (!importedGraph) throw new Error('The document opens a component path that does not exist.');
		const seeds = validated.ui?.seeds ?? [];
		if (seeds.some((seed) => !importedGraph.nodes.some((node) => node.id === seed))) {
			throw new Error('The document selects a node outside its open diagram.');
		}
		if (remember && !recordHistory())
			throw new Error(
				'Import was not applied because the previous document could not be preserved.'
			);
		// Applying or importing replaces volatile state; it is not a durable save.
		cameraGeneration += 1;
		skipImportedFit = Boolean(validated.ui?.pan || validated.ui?.zoom);
		importedDocument = validated;
		root = validated.graph;
		diagramPath = [...opened];
		layouts = validated.ui?.layouts ?? {};
		if (validated.ui?.positions)
			layouts = { ...layouts, [JSON.stringify(diagramPath)]: validated.ui.positions };
		resetLevel();
		const ui = validated.ui;
		diagramMode = ui?.diagramMode ?? 'flow';
		flowDirection = ui?.flowDirection ?? 'LR';
		traceMode = ui?.traceMode ?? 'direct';
		focusMode = ui?.focusMode ?? false;
		search = ui?.query ?? '';
		activeTags = ui?.tags ?? [];
		selectedNodeIds = [...seeds];
		selectedNodeId = seeds.length === 1 ? seeds[0] : null;
		if (ui?.pan) pan = ui.pan;
		if (ui?.zoom) zoom = ui.zoom;
		if (ui?.themePreset) applyEditorTheme(ui.themePreset);
		documentRevision += 1;
		jsonText = editorText;
		contentRevision += 1;
		sourceRevision = contentRevision;
		sourceDraftDirty = false;
		jsonMessage = 'Document applied.';
	}

	function parseInput(source: string, markdown = false): DiagramDocument {
		if (source.length > MAX_DOCUMENT_INPUT_CHARS)
			throw new Error('Diagram document exceeds the 5,000,000 character limit.');
		if (markdown) return parseDiagramMarkdown(source);
		const value: unknown = JSON.parse(source);
		try {
			return parseDiagramDocument(source);
		} catch (error) {
			if (
				typeof value === 'object' &&
				value !== null &&
				'nodes' in value &&
				'connections' in value &&
				!('format' in value && value.format === 'manef-diagram')
			)
				return importN8nWorkflow(value);
			throw error;
		}
	}

	function importJson() {
		try {
			if (jsonText.length > MAX_DOCUMENT_INPUT_CHARS)
				throw new Error('Diagram document exceeds the 5,000,000 character limit.');
			if (inputFormat === 'md') {
				const next = parseInput(jsonText, true);
				if (!confirmStaleSource()) return;
				applyImported(next);
				return;
			}
			const value: unknown = JSON.parse(jsonText);
			if (validateGraph(value) && !('format' in value && value.format === 'manef-diagram')) {
				// Legacy graph-only pastes replace the open component level.
				parseDiagramDocument(jsonText);
				if (!confirmStaleSource()) return;
				if (!commitVisible(parseGraphJson(jsonText))) return;
				rememberSelection([], []);
				armedOutput = null;
				sourceDraftDirty = false;
				sourceRevision = contentRevision;
				jsonMessage = 'JSON applied.';
			} else {
				const next = parseInput(jsonText);
				if (!confirmStaleSource()) return;
				applyImported(next);
			}
		} catch (error) {
			jsonMessage = error instanceof Error ? error.message : 'Invalid document.';
		}
	}

	function formatJson() {
		try {
			if (jsonText.length > MAX_DOCUMENT_INPUT_CHARS)
				throw new Error('Diagram document exceeds the 5,000,000 character limit.');
			if (inputFormat === 'md') jsonText = documentAsMarkdown(parseInput(jsonText, true));
			else {
				const value: unknown = JSON.parse(jsonText);
				if (!isJsonValue(value))
					throw new Error(
						'JSON requires finite numbers, safe integers and no negative zero; larger exact integers must be strings.'
					);
				jsonText = JSON.stringify(value, null, 2);
			}
			sourceDraftDirty = true;
			jsonMessage = 'Formatted.';
		} catch (error) {
			jsonMessage = error instanceof Error ? error.message : 'Format error.';
		}
	}

	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			if (file.size > 20_000_000) throw new Error('Import file exceeds 20 MB.');
			const source = await file.text();
			const markdown =
				/\.md(?:own)?$/i.test(file.name) ||
				file.type === 'text/markdown' ||
				!source.trimStart().startsWith('{');
			const next = parseInput(source, markdown);
			if (!confirmDraftReplacement()) {
				actionMessage = 'Import cancelled. The unapplied source draft is unchanged.';
				return;
			}
			applyImported(next);
			actionMessage = `Imported ${file.name}.`;
		} catch (error) {
			actionMessage = error instanceof Error ? error.message : 'Import failed.';
			jsonMessage = actionMessage;
		}
	}

	function retargetEdge(
		field: 'source' | 'sourcePort' | 'target' | 'targetPort',
		control: HTMLSelectElement
	) {
		if (!selectedEdge) return;
		const previous = selectedEdge[field];
		const next = withEdgePatch(graph, selectedEdge, { [field]: control.value });
		if (!next || !commitVisible(next)) {
			control.value = previous;
			connectionMessage =
				'That connection already exists or the port does not match. The connection is unchanged.';
			jsonMessage = connectionMessage;
			return;
		}
		connectionMessage = '';
	}

	function closeFilters() {
		filtersOpen = false;
		filterTrigger?.focus();
	}

	function toggleFilters() {
		if (filtersOpen) {
			closeFilters();
			return;
		}
		filtersOpen = true;
		void tick()
			.then(() => {
				if (filtersOpen) filterMenu?.querySelector('input')?.focus();
			})
			.catch(() => undefined);
	}

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((item) => item !== tag)
			: [...activeTags, tag];
	}

	async function shareView() {
		try {
			const edited = !sameGraph(root, defaultGraph);
			const url = buildDiagramViewUrl(
				{
					graph: edited ? root : undefined,
					query: search,
					tags: activeTags,
					seeds: selectedNodeIds,
					open: diagramPath,
					mode: diagramMode,
					flowDirection,
					trace: traceMode,
					focus: focusMode
				},
				window.location.origin
			);
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
		pointerMoved = false;
		if (overview || event.pointerType === 'touch') return;
		const start = basePositions[nodeId] ?? { x: 0, y: 0 };
		pointerMoved = false;
		nodeDrag = {
			nodeId,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			originX: start.x,
			originY: start.y,
			armed: false
		};
		event.stopPropagation();
	}

	function moveNodeDrag(event: PointerEvent) {
		if (!nodeDrag || nodeDrag.pointerId !== event.pointerId) return;
		if (!(event.buttons & 1)) {
			nodeDrag = null;
			return;
		}
		const dx = event.clientX - nodeDrag.x;
		const dy = event.clientY - nodeDrag.y;
		if (!nodeDrag.armed) {
			if (Math.abs(dx) + Math.abs(dy) < 4) return;
			if (!recordHistory()) {
				nodeDrag = null;
				return;
			}
			try {
				viewport?.setPointerCapture(event.pointerId);
			} catch {
				nodeDrag = null;
				return;
			}
			nodeDrag = { ...nodeDrag, armed: true };
			if (diagramMode === 'graph' && !reducedMotion) reheat(0.4);
		}
		pointerMoved = true;
		suppressCanvasClick = true;
		overrides = {
			...overrides,
			[nodeDrag.nodeId]: { x: nodeDrag.originX + dx / zoom, y: nodeDrag.originY + dy / zoom }
		};
	}

	function stopNodeDrag(event: PointerEvent) {
		if (nodeDrag?.pointerId === event.pointerId) nodeDrag = null;
	}

	function positionNode(axis: 'x' | 'y', control: HTMLInputElement) {
		if (!selectedNode) return;
		const previous = basePositions[selectedNode.id] ?? { x: 0, y: 0 };
		const value = Number(control.value);
		if (
			!control.value.trim() ||
			!Number.isFinite(value) ||
			Object.is(value, -0) ||
			Math.abs(value) > 100_000
		) {
			control.value = String(previous[axis]);
			actionMessage = 'Position must be a number between −100000 and 100000.';
			return;
		}
		if (value === previous[axis]) return;
		if (!recordHistory()) return;
		stopSettle();
		overrides = { ...overrides, [selectedNode.id]: { ...previous, [axis]: value } };
	}

	const zoomMin = 0.08;
	const zoomMax = 2.5;

	function zoomAt(clientX: number, clientY: number, nextZoom: number) {
		stopMotion();
		const next = Math.min(zoomMax, Math.max(zoomMin, nextZoom));
		if (!viewport) {
			zoom = next;
			return;
		}
		const bounds = viewport.getBoundingClientRect();
		pan = panForZoom(pan, { x: clientX - bounds.left, y: clientY - bounds.top }, zoom, next);
		zoom = next;
	}

	function zoomBy(factor: number) {
		if (!viewport) {
			zoom = Math.min(zoomMax, Math.max(zoomMin, zoom * factor));
			return;
		}
		const bounds = viewport.getBoundingClientRect();
		zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, zoom * factor);
	}

	function zoomActual() {
		if (!viewport) {
			zoom = 1;
			return;
		}
		const bounds = viewport.getBoundingClientRect();
		zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, 1);
	}

	function zoomSelection() {
		const fromEdges = selectedEdgeIds.flatMap((id) => {
			const edge = graph.edges.find((item) => item.id === id);
			return edge ? [edge.source, edge.target] : [];
		});
		const ids = [...new Set(selectedNodeIds.length > 0 ? selectedNodeIds : fromEdges)];
		if (ids.length === 0) return;
		fitPoints(basePositions, ids, true, false);
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
		if (reducedMotion || settleHandle || diagramMode !== 'graph') return;
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

	function replaceView(patch: Partial<NonNullable<typeof activeView>>) {
		const opened = openView;
		if (!opened) return;
		const node = graph.nodes.find((item) => item.id === opened.nodeId);
		if (!node?.views) return;
		commitVisible(
			patchNode(graph, node.id, {
				views: node.views.map((view) => (view.id === opened.viewId ? { ...view, ...patch } : view))
			})
		);
	}

	function chooseDiagram(index: number) {
		pickerIndex = Math.max(0, Math.min(pickerKinds.length - 1, index));
		viewReturnFocus = pickerTrigger;
		const kind = pickerKinds[pickerIndex];
		stopSettle();
		openView = null;
		diagramPreview = createNodeView(kind.id, selectedNode?.label ?? importedDocument.title);
		viewError = '';
		void tick()
			.then(() =>
				document.getElementById(`diagram-kind-${kind.id}`)?.scrollIntoView({ block: 'nearest' })
			)
			.catch(() => undefined);
	}

	function closePicker() {
		pickerOpen = false;
		pickerTrigger?.focus();
	}

	function togglePicker() {
		if (pickerOpen) {
			closePicker();
			return;
		}
		filtersOpen = false;
		pickerOpen = true;
		chooseDiagram(pickerIndex);
		void tick()
			.then(() => pickerList?.focus())
			.catch(() => undefined);
	}

	function pickerKeydown(event: KeyboardEvent) {
		if (event.key === 'Tab') {
			event.preventDefault();
			pickerOpen = false;
			void tick()
				.then(() => {
					if (event.shiftKey) pickerTrigger?.focus();
					else document.querySelector<HTMLSelectElement>('.top-end select')?.focus();
				})
				.catch(() => undefined);
			return;
		}
		if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === 'ArrowDown') chooseDiagram((pickerIndex + 1) % pickerKinds.length);
			else if (event.key === 'ArrowUp')
				chooseDiagram((pickerIndex - 1 + pickerKinds.length) % pickerKinds.length);
			else if (event.key === 'Home') chooseDiagram(0);
			else if (event.key === 'End') chooseDiagram(pickerKinds.length - 1);
			else closePicker();
		}
	}

	function addPreview() {
		const node = selectedNode;
		const preview = diagramPreview;
		if (!node || !preview) return;
		const view = { ...preview };
		if (!commitVisible(patchNode(graph, node.id, { views: [...(node.views ?? []), view] }))) return;
		diagramPreview = null;
		pickerOpen = false;
		openNodeView(node.id, view.id, pickerTrigger ?? undefined);
	}

	function setFlowDirection(direction: FlowDirection) {
		if (diagramMode !== 'flow' || flowDirection === direction || !recordHistory()) return;
		stopSettle();
		flowDirection = direction;
		overrides = {};
		layouts = { ...layouts, [JSON.stringify(diagramPath)]: {} };
	}

	function setViewFormat(format: 'md' | 'json') {
		if (!activeView || activeView.format === format) return;
		try {
			replaceView(convertNodeView(activeView, format));
			viewError = '';
		} catch (error) {
			viewError = error instanceof Error ? error.message : 'Could not convert this view.';
		}
	}

	function removeView() {
		const opened = openView;
		if (!opened) return;
		const node = graph.nodes.find((item) => item.id === opened.nodeId);
		if (!node?.views) return;
		commitVisible(
			patchNode(graph, node.id, {
				views: node.views.filter((view) => view.id !== opened.viewId)
			})
		);
		openView = null;
		diagramPreview = null;
		viewError = '';
		actionMessage = 'View removed. Undo can restore its source.';
		focusAfterChange('view-picker');
	}

	$effect(() => {
		const view = activeView;
		const host = viewHost;
		const theme = appliedTheme;
		if (!view || !host) return;
		let source = '';
		try {
			source = mermaidSource(view);
		} catch (error) {
			viewError = error instanceof Error ? error.message : 'Could not read this view.';
			host.innerHTML = '';
			return;
		}
		let cancel = false;
		const renderId = `mmd-${crypto.randomUUID()}`;
		host.dataset.viewKind = '';
		host.setAttribute('aria-busy', 'true');
		host.innerHTML = '';
		void import('mermaid')
			.then(async (mod) => {
				if (cancel) return;
				const mermaid = mod.default;
				mermaid.initialize({
					startOnLoad: false,
					suppressErrorRendering: true,
					securityLevel: 'strict',
					theme: theme === 'composio-dark' ? 'dark' : 'neutral',
					fontFamily: 'inherit'
				});
				const drawn = await mermaid.render(renderId, source);
				if (cancel) return;
				host.innerHTML = drawn.svg;
				host.dataset.viewKind = view.kind;
				host.setAttribute('aria-busy', 'false');
				viewError = '';
			})
			.catch((error: unknown) => {
				if (cancel) return;
				host.innerHTML = '';
				host.setAttribute('aria-busy', 'false');
				viewError = error instanceof Error ? error.message : 'This diagram could not be drawn.';
			});
		return () => {
			cancel = true;
		};
	});

	function startSettle() {
		openView = null;
		diagramPreview = null;
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
		if (reducedMotion) {
			overrides = layoutGraph(graph, 'graph');
			void tick()
				.then(() => fitView())
				.catch(() => undefined);
			return;
		}
		overrides = seed;
		settleVelocity = {};
		simAlpha = 1;
		fitWhenCool = fromFlow;
		ensureSim();
	}

	function setForces(patch: Partial<typeof forces>) {
		forces = { ...forces, ...patch, ...(reducedMotion ? { animate: false } : {}) };
		if (diagramMode === 'graph') reheat(patch.layout ? 1 : 0.7);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && pickerOpen) {
			event.preventDefault();
			closePicker();
			return;
		}
		if (pickerOpen) {
			if (
				event.key === 'Delete' ||
				event.key === 'Backspace' ||
				((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase()))
			)
				event.preventDefault();
			return;
		}
		if (event.key === 'Escape' && filtersOpen) {
			event.preventDefault();
			closeFilters();
			return;
		}
		const target = event.target;
		if (event.isComposing || !(target instanceof Element) || !target.closest('.workspace')) return;
		if (
			target.closest(
				'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
			)
		)
			return;
		if (
			(event.ctrlKey || event.metaKey) &&
			!event.altKey &&
			(event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')
		) {
			event.preventDefault();
			travelHistory(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
			return;
		}
		if (event.key === 'Escape') {
			if (armedOutput) {
				armedOutput = null;
				return;
			}
			rememberSelection([], []);
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.length > 0) {
			event.preventDefault();
			removeSelectedNodes();
			return;
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeIds.length > 0) {
			event.preventDefault();
			disconnectEdge(selectedEdgeIds[0]);
		}
	}

	function panBy(x: number, y: number) {
		stopMotion();
		cameraGeneration += 1;
		pan = { x: pan.x + x, y: pan.y + y };
	}

	function releaseCanvasGesture() {
		touchPoints.clear();
		touchPinch = null;
		nodeDrag = null;
		spaceHeld = false;
		panStart = null;
		marqueeDrag = null;
		marquee = null;
	}

	function canvasKeydown(event: KeyboardEvent) {
		if (
			event.target !== viewport ||
			activeView ||
			event.isComposing ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey
		)
			return;
		const step = event.shiftKey ? 160 : 40;
		const movement: Record<string, Point> = {
			ArrowLeft: { x: step, y: 0 },
			ArrowRight: { x: -step, y: 0 },
			ArrowUp: { x: 0, y: step },
			ArrowDown: { x: 0, y: -step }
		};
		const direction = movement[event.key];
		if (direction) {
			event.preventDefault();
			panBy(direction.x, direction.y);
		} else if (event.key === ' ') {
			event.preventDefault();
			spaceHeld = true;
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomBy(1.1);
		} else if (event.key === '-') {
			event.preventDefault();
			zoomBy(1 / 1.1);
		} else if (event.key === '0' || event.key.toLowerCase() === 'f') {
			event.preventDefault();
			fitView();
		} else if (event.key === '1') {
			event.preventDefault();
			zoomActual();
		}
	}

	function startPan(event: PointerEvent) {
		const narrow = window.matchMedia('(max-width: 64rem)').matches;
		if (activeView || (narrow && !mobileCanvas)) return;
		const target = event.target;
		if (
			!(target instanceof Element) ||
			target.closest('.toolbar, .canvas-navigation, .forces, .mermaid-view, .empty-map')
		)
			return;
		suppressCanvasClick = false;
		const hand = canvasTool === 'pan' || spaceHeld;
		const interactive = target.closest('[data-interactive], .dot-hit');
		if (event.pointerType === 'touch') {
			if (event.isPrimary) touchPoints.clear();
			touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (touchPoints.size === 2 && viewport) {
				const [a, b] = [...touchPoints.values()];
				const rect = viewport.getBoundingClientRect();
				touchPinch = {
					distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
					center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
					pan: { ...pan },
					zoom
				};
				for (const id of touchPoints.keys()) viewport.setPointerCapture(id);
				panStart = null;
				nodeDrag = null;
				suppressCanvasClick = true;
				stopMotion();
				cameraGeneration += 1;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
		}
		if (!hand && interactive && event.button !== 1) return;
		if (
			event.button === 1 ||
			(event.button === 0 && (hand || narrow || event.pointerType === 'touch'))
		) {
			event.preventDefault();
			event.stopPropagation();
			stopMotion();
			cameraGeneration += 1;
			viewport?.focus({ preventScroll: true });
			viewport?.setPointerCapture(event.pointerId);
			suppressCanvasClick = hand;
			panStart = {
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				panX: pan.x,
				panY: pan.y,
				nodeId: target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? undefined
			};
			return;
		}
		if (event.button !== 0 || target.closest('.node, .dot, .edge-hit')) return;
		viewport?.focus({ preventScroll: true });
		viewport?.setPointerCapture(event.pointerId);
		marqueeDrag = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			shift: event.shiftKey
		};
	}

	function moveTouch(event: PointerEvent): boolean {
		if (event.pointerType !== 'touch' || !touchPoints.has(event.pointerId)) return false;
		touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (!touchPinch || touchPoints.size !== 2 || !viewport) return false;
		const [a, b] = [...touchPoints.values()];
		const rect = viewport.getBoundingClientRect();
		const center = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
		const nextZoom = Math.max(
			zoomMin,
			Math.min(zoomMax, (touchPinch.zoom * Math.hypot(b.x - a.x, b.y - a.y)) / touchPinch.distance)
		);
		const anchored = panForZoom(touchPinch.pan, touchPinch.center, touchPinch.zoom, nextZoom);
		pan = {
			x: anchored.x + center.x - touchPinch.center.x,
			y: anchored.y + center.y - touchPinch.center.y
		};
		zoom = nextZoom;
		return true;
	}

	function finishTouch(event: PointerEvent) {
		if (!touchPoints.delete(event.pointerId)) return;
		if (!touchPinch) return;
		touchPinch = null;
		const remaining = [...touchPoints.entries()][0];
		if (remaining) {
			const [pointerId, point] = remaining;
			panStart = { pointerId, x: point.x, y: point.y, panX: pan.x, panY: pan.y };
		}
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
		if (Math.abs(event.clientX - panStart.x) + Math.abs(event.clientY - panStart.y) > 3)
			suppressCanvasClick = true;
		pan = {
			x: panStart.panX + event.clientX - panStart.x,
			y: panStart.panY + event.clientY - panStart.y
		};
	}

	function stopPan(event: PointerEvent) {
		if (panStart?.pointerId === event.pointerId) panStart = null;
	}

	function handleWheel(event: WheelEvent) {
		if (window.matchMedia('(max-width: 64rem)').matches && (!mobileCanvas || activeView)) return;
		if (
			event.target instanceof Element &&
			event.target.closest('.toolbar, .canvas-navigation, .forces, .mermaid-view')
		)
			return;
		event.preventDefault();
		const gesture = wheelGesture(event, viewport?.clientHeight ?? 800);
		if (gesture.kind === 'zoom') zoomAt(event.clientX, event.clientY, zoom * gesture.factor);
		else panBy(gesture.delta.x, gesture.delta.y);
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (pickerOpen && event.target instanceof Node && !pickerWrapper?.contains(event.target))
			pickerOpen = false;
	}}
	onpointerup={stopNodeDrag}
	onpointercancel={stopNodeDrag}
	onbeforeunload={(event) => {
		if (hasUnsavedEdits || sourceDraftDirty) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
	onkeydown={onKeydown}
	onkeyup={(event) => {
		if (event.key === ' ') spaceHeld = false;
	}}
	onblur={releaseCanvasGesture}
/>

<svelte:head>
	<title>MANEF Architecture</title>
	<meta
		name="description"
		content="Explore and edit a reusable graph of MANEF products, infrastructure and modular features."
	/>
</svelte:head>

<main
	class="workspace"
	class:explorer-collapsed={explorerCollapsed}
	class:inspector-collapsed={inspectorCollapsed}
	class:phone-canvas={mobileCanvas}
	data-theme={appliedTheme}
	data-flow-direction={flowDirection}
>
	<header class="topbar">
		<div class="brand" inert={pickerOpen}>
			<a class="logo" href={resolve('/')} aria-label="Manef Diagram home">M</a>
			<div>
				<h1>MANEF Architecture</h1>
				<small
					>{diagramPath.length === 0
						? 'public service map'
						: (crumbs.at(-1)?.label ?? 'component diagram')}</small
				>
			</div>
		</div>
		<div class="mode-center">
			<div class="segmented" aria-label="Diagram mode" inert={pickerOpen}>
				<Button
					data-interactive
					variant={diagramMode === 'flow' && !activeView ? 'default' : 'ghost'}
					aria-pressed={diagramMode === 'flow' && !activeView}
					disabled={!hydrated}
					size="sm"
					onclick={showFlow}>Flow</Button
				>
				<Button
					data-interactive
					variant={diagramMode === 'graph' && !activeView ? 'default' : 'ghost'}
					aria-pressed={diagramMode === 'graph' && !activeView}
					disabled={!hydrated}
					size="sm"
					onclick={startSettle}>Graph</Button
				>
			</div>
			<div
				class="diagram-picker"
				bind:this={pickerWrapper}
				onfocusout={(event) => {
					if (
						!(event.relatedTarget instanceof Node) ||
						!pickerWrapper?.contains(event.relatedTarget)
					)
						pickerOpen = false;
				}}
			>
				<button
					type="button"
					class="theme-select"
					bind:this={pickerTrigger}
					aria-label="Diagram type"
					aria-haspopup="listbox"
					aria-expanded={pickerOpen}
					aria-controls="diagram-kind-list"
					disabled={!hydrated}
					onclick={togglePicker}
					onkeydown={(event) => {
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							if (!pickerOpen) {
								togglePicker();
								if (event.key === 'ArrowUp') chooseDiagram(pickerKinds.length - 1);
							}
						}
					}}
				>
					Diagram type <span aria-hidden="true">▾</span>
				</button>
				{#if pickerOpen}
					<div
						id="diagram-kind-list"
						class="diagram-kind-list"
						role="listbox"
						aria-label="Diagram types"
						tabindex="0"
						bind:this={pickerList}
						aria-activedescendant={`diagram-kind-${pickerKinds[pickerIndex].id}`}
						onkeydown={pickerKeydown}
					>
						{#each diagramKindGroups as group (group.group)}
							<div role="group" aria-label={group.group}>
								<div class="diagram-kind-group" aria-hidden="true">{group.group}</div>
								{#each group.kinds as kind (kind.id)}
									<button
										type="button"
										role="option"
										tabindex="-1"
										id={`diagram-kind-${kind.id}`}
										aria-selected={pickerKinds[pickerIndex].id === kind.id}
										onmousedown={(event) => event.preventDefault()}
										onclick={() => {
											chooseDiagram(pickerKinds.findIndex((item) => item.id === kind.id));
											pickerList?.focus();
										}}>{kind.label}</button
									>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div class="top-end" inert={pickerOpen}>
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
			<select class="theme-select" aria-label="Export format" bind:value={exportFormat}>
				<option value="json">JSON document</option>
				<option value="md">Markdown document</option>
				<option value="n8n">n8n workflow (original)</option>
				<option value="n8n-inactive">n8n workflow (inactive)</option>
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
					accept=".json,.md,.markdown,application/json,text/markdown,text/plain"
					hidden
					onchange={importFile}
				/>
				<Button data-interactive variant="outline" size="sm" onclick={shareView}>Share view</Button>
			</div>
		</div>
	</header>
	{#if actionMessage}<p class="toast" role="status">{actionMessage}</p>{/if}

	<div class="layout" inert={pickerOpen}>
		<aside class="sidebar" id="diagram-explorer">
			<section class="search-section">
				<h2>Explore canvas</h2>
				<Input aria-label="Search graph" placeholder="Search graph…" bind:value={search} />
				<a class="mobile-inspect" href="#diagram-map">Open map ↓</a>
			</section>
			<section>
				<div class="filter-wrap">
					<button
						type="button"
						class="filter-toggle"
						bind:this={filterTrigger}
						aria-expanded={filtersOpen}
						aria-controls="tag-filter-menu"
						onclick={toggleFilters}
					>
						<span>Filter{activeTags.length ? ` (${activeTags.length})` : ''}</span>
						<span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
					</button>
					{#if filtersOpen}
						<button
							type="button"
							class="filter-backdrop"
							aria-label="Close filters"
							onclick={closeFilters}
							tabindex="-1"
						></button>
						<div
							id="tag-filter-menu"
							bind:this={filterMenu}
							class="filter-menu"
							role="dialog"
							aria-label="Tag filters"
						>
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
				<h2>Camera pan</h2>
				<div class="camera-pan-buttons" role="group" aria-label="Pan without dragging">
					<Button size="sm" variant="outline" aria-label="Pan left" onclick={() => panBy(80, 0)}
						>←</Button
					>
					<Button size="sm" variant="outline" aria-label="Pan up" onclick={() => panBy(0, 80)}
						>↑</Button
					>
					<Button size="sm" variant="outline" aria-label="Pan down" onclick={() => panBy(0, -80)}
						>↓</Button
					>
					<Button size="sm" variant="outline" aria-label="Pan right" onclick={() => panBy(-80, 0)}
						>→</Button
					>
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
				<div class="history-controls" role="group" aria-label="Document history">
					<Button
						size="sm"
						variant="outline"
						disabled={!undoStack.length}
						onclick={() => travelHistory('undo')}>Undo</Button
					>
					<Button
						size="sm"
						variant="outline"
						disabled={!redoStack.length}
						onclick={() => travelHistory('redo')}>Redo</Button
					>
				</div>
				<p class="help" aria-live="polite">
					{hasUnsavedEdits || sourceDraftDirty
						? 'Unsaved changes — export a document to keep them.'
						: 'Local editor — export a document to keep your work.'}
				</p>
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
					Select a service to inspect it. Use Pan to drag with a trackpad or any pointer. Two-finger
					scroll pans; Ctrl/⌘ + scroll or pinch zooms. Select mode keeps box selection.
				</p>
				<details class="canvas-guide">
					<summary>Keyboard and canvas controls</summary>
					<p id="canvas-instructions">
						Tab to the canvas. Arrow keys pan; Shift moves farther. + / − zoom, F or 0 fits, 1 shows
						actual size. Hold Space and drag to pan. Tab leaves the canvas. Escape cancels a
						connection or clears selection.
					</p>
				</details>
				<details class="service-navigator" open={overview}>
					<summary>Find a service ({visibleNodes.length})</summary>
					<ul>
						{#each visibleNodes as node (node.id)}
							<li>
								<button
									type="button"
									aria-pressed={selectedNodeIds.includes(node.id)}
									aria-label={[node.label, node.subtitle].filter(Boolean).join(' ')}
									onclick={() => {
										selectNode(node.id);
										viewport?.focus({ preventScroll: true });
									}}>{node.label}</button
								>
							</li>
						{/each}
					</ul>
				</details>
				<p class="help">Edits are in this tab only. Export a document to keep your work.</p>
			</section>
		</aside>

		<section class="canvas-shell" id="diagram-map">
			<nav class="mobile-tools" aria-label="Phone diagram controls">
				<Button
					disabled={!hydrated}
					variant={mobileCanvas ? 'outline' : 'default'}
					aria-pressed={!mobileCanvas}
					onclick={() => {
						openView = null;
						diagramPreview = null;
						viewError = '';
						mobileCanvas = false;
					}}>List</Button
				>
				<Button
					disabled={!hydrated}
					variant={mobileCanvas ? 'default' : 'outline'}
					aria-pressed={mobileCanvas}
					onclick={async () => {
						openView = null;
						diagramPreview = null;
						viewError = '';
						mobileCanvas = true;
						await tick();
						fitView();
					}}>Canvas</Button
				>
				<a href="#diagram-inspector"
					>Inspect{selectedNode
						? `: ${selectedNode.label}`
						: selectedEdge
							? ': connection'
							: ' / JSON'}</a
				>
			</nav>
			<p class="mobile-help">
				Tap a service or connection, then Inspect to edit. In Canvas, drag to move around and use +
				/ − to zoom. Scroll outside the canvas to move down the page.
			</p>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (This application surface implements keyboard pan and zoom; native child controls retain their own keyboard behavior.) -->
			<div
				class="viewport"
				class:has-view={Boolean(activeView)}
				class:overview
				class:hand-tool={canvasTool === 'pan' || spaceHeld}
				class:panning={Boolean(panStart)}
				role="application"
				tabindex="0"
				aria-label="MANEF architecture graph canvas"
				aria-describedby="canvas-instructions"
				onkeydown={canvasKeydown}
				onclickcapture={(event) => {
					if (suppressCanvasClick) {
						event.preventDefault();
						event.stopPropagation();
						suppressCanvasClick = false;
					}
				}}
				bind:this={viewport}
				onpointerdowncapture={startPan}
				onauxclick={(event) => event.preventDefault()}
				onpointermove={(event) => {
					if (moveTouch(event)) return;
					moveNodeDrag(event);
					movePan(event);
					moveMarquee(event);
				}}
				onpointerup={(event) => {
					if (
						overview &&
						!suppressCanvasClick &&
						!nodeDrag?.armed &&
						canvasTool === 'select' &&
						event.target instanceof Element
					) {
						const id =
							panStart?.nodeId ??
							event.target.closest('[data-node-id]')?.getAttribute('data-node-id');
						if (id) {
							selectNode(id);
						}
					}
					finishTouch(event);
					stopNodeDrag(event);
					stopPan(event);
					finishMarquee(event);
				}}
				onpointercancel={(event) => {
					touchPoints.clear();
					touchPinch = null;
					stopNodeDrag(event);
					stopPan(event);
					marqueeDrag = null;
					marquee = null;
				}}
				onlostpointercapture={(event) => {
					stopNodeDrag(event);
					stopPan(event);
					marqueeDrag = null;
					marquee = null;
				}}
				onwheel={handleWheel}
			>
				{#if !activeView}
					<div class="canvas-navigation" data-interactive aria-label="Canvas navigation">
						<div role="group" aria-label="Canvas tool">
							<Button
								size="sm"
								variant={canvasTool === 'select' ? 'default' : 'outline'}
								aria-pressed={canvasTool === 'select'}
								onclick={() => (canvasTool = 'select')}>Select</Button
							>
							<Button
								size="sm"
								variant={canvasTool === 'pan' ? 'default' : 'outline'}
								aria-pressed={canvasTool === 'pan'}
								onclick={() => (canvasTool = 'pan')}>Pan</Button
							>
						</div>
						<div class="panel-toggles" role="group" aria-label="Side panels">
							<Button
								size="sm"
								variant="outline"
								aria-label={explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
								aria-expanded={!explorerCollapsed}
								aria-controls="diagram-explorer"
								onclick={() => (explorerCollapsed = !explorerCollapsed)}>Explorer</Button
							>
							<Button
								size="sm"
								variant="outline"
								aria-label={inspectorCollapsed ? 'Show inspector' : 'Hide inspector'}
								aria-expanded={!inspectorCollapsed}
								aria-controls="diagram-inspector"
								onclick={() => (inspectorCollapsed = !inspectorCollapsed)}>Inspector</Button
							>
						</div>
						<div role="group" aria-label="Flow direction">
							{#each [{ value: 'RL', symbol: '←', label: 'Flow right to left' }, { value: 'BT', symbol: '↑', label: 'Flow bottom to top' }, { value: 'TB', symbol: '↓', label: 'Flow top to bottom' }, { value: 'LR', symbol: '→', label: 'Flow left to right' }] as direction (direction.value)}
								<Button
									size="sm"
									variant={flowDirection === direction.value ? 'default' : 'outline'}
									aria-label={direction.label}
									aria-pressed={flowDirection === direction.value}
									disabled={diagramMode !== 'flow'}
									onclick={() => setFlowDirection(direction.value as FlowDirection)}
									>{direction.symbol}</Button
								>
							{/each}
						</div>
					</div>
				{/if}
				{#if activeView}
					<div class="mermaid-view" bind:this={viewPanel} data-interactive>
						<div class="view-bar">
							<strong>{activeView.title}</strong>
							{#if diagramPreview}<span>Preview — not added</span><Button
									size="sm"
									disabled={!selectedNode}
									onclick={addPreview}>Add to selected node</Button
								>{/if}
							<span>{activeView.format === 'md' ? 'Markdown' : 'JSON'}</span>
							<Button size="sm" variant="outline" onclick={closeNodeView}>Map</Button>
						</div>
						{#if viewError}<p class="help">{viewError}</p>{/if}
						<div class="view-canvas" bind:this={viewHost}></div>
					</div>
				{/if}
				{#if visibleNodes.length === 0}
					<div class="empty-map" data-interactive>
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
				<ol class="mobile-map" inert={Boolean(activeView)} aria-hidden={Boolean(activeView)}>
					{#each [...visibleNodes].sort((a, b) => (a.level ?? 3) - (b.level ?? 3) || a.label.localeCompare(b.label)) as node (node.id)}
						<li>
							<button
								type="button"
								class="mobile-card"
								aria-pressed={selectedNodeIds.includes(node.id)}
								class:selected={selectedNodeIds.includes(node.id)}
								class:hot={highlightedNodeIds.has(node.id)}
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
							{#if selectedNodeId === node.id}<a class="mobile-inspect" href="#diagram-inspector"
									>Edit {node.label}</a
								>{/if}
							{#each visibleEdges.filter((edge) => edge.source === node.id) as edge (edge.id)}
								<button
									type="button"
									class="mobile-edge"
									class:hot={highlightedEdgeIds.has(edge.id)}
									aria-pressed={selectedEdgeId === edge.id}
									onclick={() => selectEdge(edge.id)}
								>
									{edge.label ?? 'connects'} → {graph.nodes.find((item) => item.id === edge.target)
										?.label}
								</button>
								{#if selectedEdgeId === edge.id}<a class="mobile-inspect" href="#diagram-inspector"
										>Edit connection</a
									>{/if}
							{/each}
						</li>
					{/each}
				</ol>
				<div
					class="world"
					inert={Boolean(activeView)}
					aria-hidden={Boolean(activeView)}
					style={worldStyle}
				>
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
									tabindex="-1"
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
								data-node-id={node.id}
								class:hot={highlightedNodeIds.has(node.id)}
								class:selected={selectedNodeIds.includes(node.id)}
								class:dragging={nodeDrag?.armed === true && nodeDrag.nodeId === node.id}
								class:dim={emphasize && !highlightedNodeIds.has(node.id)}
								style={`left: ${basePositions[node.id]?.x ?? 0}px; top: ${basePositions[node.id]?.y ?? 0}px; --r: ${nodeRadius(node.id) * (forces.nodeSize / 100)}px; --dot: ${dotColor(node)};`}
							>
								<button
									type="button"
									class="dot-hit"
									disabled={overview}
									aria-hidden={overview}
									aria-pressed={selectedNodeIds.includes(node.id)}
									title={node.subtitle || node.label}
									onpointerenter={() => (hoveredNodeId = node.id)}
									onpointerleave={() => {
										if (hoveredNodeId === node.id) hoveredNodeId = null;
									}}
									onpointerdown={(event) => {
										if (event.button !== 0) return;
										startNodeDrag(event, node.id);
									}}
									onclick={(event) => selectNode(node.id, event.detail !== 0, event.shiftKey)}
								>
									<span class="dot-mark" aria-hidden="true"></span>
									<span class="dot-label">{node.label}</span>
								</button>
							</article>
						{:else}
							<article
								class="node"
								data-node-id={node.id}
								class:hot={highlightedNodeIds.has(node.id)}
								class:selected={selectedNodeIds.includes(node.id)}
								class:dragging={nodeDrag?.armed === true && nodeDrag.nodeId === node.id}
								class:dim={emphasize && !highlightedNodeIds.has(node.id)}
								class:context={contextNodeIds.has(node.id)}
								class:connecting={armedOutput?.nodeId === node.id}
								data-status={node.status ?? 'active'}
								style={`left: ${basePositions[node.id]?.x ?? 0}px; top: ${basePositions[node.id]?.y ?? 0}px; width: ${flowCard.width}px; height: ${flowCard.height}px;`}
								onpointerdown={(event) => {
									if (event.button !== 0) return;
									if (event.target instanceof Element && event.target.closest('.port')) return;
									startNodeDrag(event, node.id);
								}}
							>
								<div class="node-head">
									<Button
										data-interactive
										class="node-select"
										disabled={overview}
										aria-hidden={overview}
										aria-pressed={selectedNodeIds.includes(node.id)}
										variant="ghost"
										onclick={(event) => selectNode(node.id, event.detail !== 0, event.shiftKey)}
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
									{#each node.inputs as port, index (port.id)}
										<button
											type="button"
											class="port in"
											style={`--port-position: ${18 + ((index + 1) / (node.inputs.length + 1)) * ((flowDirection === 'TB' || flowDirection === 'BT' ? flowCard.width : flowCard.height) - 36)}px`}
											disabled={overview || node.inputs.length > 3}
											aria-hidden={overview || node.inputs.length > 3}
											aria-label={`${node.label}: input ${port.label}`}
											data-interactive
											onclick={() => connectTo(node.id, port.id)}
										>
											<span class="socket"></span><span class="port-label">{port.label}</span>
										</button>
									{/each}
								</div>
								<div class="port-side outputs">
									{#each node.outputs as port, index (port.id)}
										<button
											type="button"
											class="port out"
											style={`--port-position: ${18 + ((index + 1) / (node.outputs.length + 1)) * ((flowDirection === 'TB' || flowDirection === 'BT' ? flowCard.width : flowCard.height) - 36)}px`}
											disabled={overview || node.outputs.length > 3}
											aria-hidden={overview || node.outputs.length > 3}
											aria-label={`${node.label}: output ${port.label}`}
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
					<div class="forces" class:phone-open={mobileForces} id="graph-physics" data-interactive>
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
								disabled={reducedMotion}
								title={reducedMotion
									? 'Animation is disabled by your reduced-motion preference.'
									: undefined}
								onclick={() => setForces({ animate: !forces.animate })}
								>{forces.animate ? 'Pause' : 'Animate'}</button
							>
							<button
								type="button"
								disabled={reducedMotion}
								title={reducedMotion
									? 'Physics is paused by your reduced-motion preference.'
									: undefined}
								onclick={() => reheat(1)}>Reheat</button
							>
						</div>
					</div>
				{/if}
				<div class="toolbar" data-interactive>
					<Button size="sm" variant="outline" onclick={() => fitView(true)}>Fit</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}
						onclick={zoomSelection}>Zoom selection</Button
					>
					<Button size="sm" variant="outline" onclick={zoomActual}>100%</Button>
					<Button size="sm" variant="outline" onclick={() => zoomBy(0.9)} aria-label="Zoom out"
						>−</Button
					>
					<span>{Math.round(zoom * 100)}%</span>
					<Button size="sm" variant="outline" onclick={() => zoomBy(1.1)} aria-label="Zoom in"
						>+</Button
					>
					<Button size="sm" variant="outline" onclick={startSettle}>Settle</Button>
					{#if diagramMode === 'graph'}<Button
							class="mobile-physics"
							size="sm"
							variant="outline"
							aria-expanded={mobileForces}
							aria-controls="graph-physics"
							onclick={() => (mobileForces = !mobileForces)}>Physics</Button
						>{/if}
					{#if armedOutput}
						<Button size="sm" variant="outline" onclick={() => (armedOutput = null)}>Cancel</Button>
					{/if}
				</div>
				<div class="status">
					{overview ? 'Overview · select a service, then Zoom selection · ' : ''}{diagramMode ===
					'flow'
						? 'Flow'
						: 'Graph'} · {selectedNodeIds.length > 1
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
			</div>
			{#if visibleEdges.length}
				<div class="edge-strip" aria-label="Connections">
					{#each visibleEdges as edge (edge.id)}
						<Button
							size="sm"
							variant={selectedEdgeId === edge.id ? 'default' : 'outline'}
							aria-pressed={selectedEdgeId === edge.id}
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

		<aside class="inspector" id="diagram-inspector">
			<a class="mobile-inspect" href="#diagram-map">Back to map ↑</a>
			<Tabs.Root
				value={inspectorTab}
				onValueChange={(value) => {
					if (value === 'details' || value === 'inventory' || value === 'json')
						inspectorTab = value;
				}}
			>
				<Tabs.List class="tabs" aria-label="Inspector">
					<Tabs.Trigger value="details" class={inspectorTab === 'details' ? 'active' : ''}
						>Details</Tabs.Trigger
					>
					<Tabs.Trigger value="inventory" class={inspectorTab === 'inventory' ? 'active' : ''}
						>Inventory</Tabs.Trigger
					>
					<Tabs.Trigger value="json" class={inspectorTab === 'json' ? 'active' : ''}
						>JSON</Tabs.Trigger
					>
				</Tabs.List>

				<Tabs.Content value="inventory">
					<div class="panel">
						<p class="help">
							References {inventoryCount(inventory, 'reference')} · Repos {inventoryCount(
								inventory,
								'repo'
							)} · Domains {inventoryCount(inventory, 'domain')} · Hosts {inventoryCount(
								inventory,
								'hostname'
							)} · Convex {inventoryCount(inventory, 'convex')}. Private records are not in this
							bundled inventory. Imported documents live only in this tab. Export JSON or Markdown
							to keep them.
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
				</Tabs.Content>
				<Tabs.Content value="json">
					<div class="panel">
						<select class="theme-select" aria-label="Input format" bind:value={inputFormat}>
							<option value="json">JSON document or n8n workflow</option>
							<option value="md">Markdown document</option>
						</select>
						<p class="help">
							JSON and Markdown preserve the complete document. A bare graph JSON replaces the open
							diagram level.
						</p>
						<p class="help">
							<a href={asset('/workflows/manef-diagram-converter.json')} download
								>Download n8n converter workflow</a
							>
							· <a href={resolve('/guide?section=converters')}>Converter guide</a>
						</p>
						<textarea
							class="json"
							bind:value={jsonText}
							oninput={() => (sourceDraftDirty = true)}
							spellcheck="false"
							aria-label="Architecture graph JSON"></textarea>
						<div class="json-actions">
							<Button size="sm" variant="outline" onclick={() => syncJson()}>Refresh</Button>
							<Button size="sm" variant="outline" onclick={formatJson}>Format</Button>
							<Button size="sm" onclick={importJson}
								>{inputFormat === 'md' ? 'Apply Markdown' : 'Apply JSON'}</Button
							>
						</div>
						{#if sourceRevision !== contentRevision}<p class="help">
								Canvas edits are newer than this source. Refresh loads the current document; Apply
								asks before replacing those edits.
							</p>{/if}
						{#if sourceDraftDirty}<p class="help">
								Unapplied source draft. Apply it or copy it before leaving.
							</p>{/if}
						{#if jsonMessage}<p class="help" aria-live="polite">{jsonMessage}</p>{/if}
					</div>
				</Tabs.Content>
				<Tabs.Content value="details">
					{#if selectedNodeIds.length > 1}
						<div class="panel">
							<h2>{selectedNodeIds.length} nodes selected</h2>
							<p class="help">
								Drag left to right selects only what is fully inside. Drag right to left also
								selects what the box touches.
							</p>
							<Button variant="destructive" size="sm" onclick={removeSelectedNodes}
								>Remove selected nodes</Button
							>
						</div>
					{:else if selectedNode}
						<div class="panel">
							<h2>Node details</h2>
							<fieldset class="node-position">
								<legend>Position without dragging</legend>
								<label
									>X <Input
										type="number"
										aria-label="Node X position"
										min="-100000"
										max="100000"
										value={basePositions[selectedNode.id]?.x ?? 0}
										onchange={(event) => positionNode('x', event.currentTarget)}
									/></label
								>
								<label
									>Y <Input
										type="number"
										aria-label="Node Y position"
										min="-100000"
										max="100000"
										value={basePositions[selectedNode.id]?.y ?? 0}
										onchange={(event) => positionNode('y', event.currentTarget)}
									/></label
								>
							</fieldset>
							{#if selectedNode.child}
								<Button size="sm" onclick={() => openDiagram(selectedNode.id)}
									>Open component diagram</Button
								>
								<p class="help">Click the selected service again to open its components.</p>
							{:else if diagramPath.length >= MAX_DIAGRAM_DEPTH}
								<p>This is as deep as a diagram can go.</p>
							{:else}
								<Button
									size="sm"
									variant="outline"
									onclick={() => addComponentDiagram(selectedNode.id)}>Add component diagram</Button
								>
							{/if}
							<div class="view-editor">
								<span>Views</span>
								{#if selectedNode.views?.length}
									<div class="view-list">
										{#each selectedNode.views as view (view.id)}
											<button
												type="button"
												class:active={openView?.viewId === view.id}
												onclick={(event) =>
													openNodeView(selectedNode.id, view.id, event.currentTarget)}
												>{view.title}</button
											>
										{/each}
									</div>
								{:else}
									<p class="help">
										Preview a type in Diagram type, then use Add to selected node. Markdown or JSON,
										one diagram per saved view.
									</p>
								{/if}
								{#if activeView && openView?.nodeId === selectedNode.id}
									<div class="segmented">
										<button
											type="button"
											aria-pressed={activeView.format === 'md'}
											onclick={() => setViewFormat('md')}>Markdown</button
										>
										<button
											type="button"
											aria-pressed={activeView.format === 'json'}
											onclick={() => setViewFormat('json')}>JSON</button
										>
									</div>
									<textarea
										class="view-source"
										aria-label="Diagram source"
										spellcheck="false"
										value={activeView.source}
										oninput={(event) => replaceView({ source: event.currentTarget.value })}
									></textarea>
									<Button size="sm" variant="outline" onclick={removeView}>Remove view</Button>
								{/if}
							</div>
							<label>
								<span>Label</span>
								<Input
									id="selected-node-label"
									value={selectedNode.label}
									oninput={(event) =>
										updateNode(selectedNode.id, { label: event.currentTarget.value })}
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
								<p class="mobile-help">
									To connect services, choose Use output, return to the map, select the target
									service, then choose Connect on its input.
								</p>
								{#if armedOutput}<Button
										class="mobile-port-action"
										variant="outline"
										onclick={() => (armedOutput = null)}>Cancel connection</Button
									>{/if}
								<div>
									<div class="editor-heading">
										<strong>Inputs</strong>
										<Button
											size="sm"
											variant="outline"
											aria-label="Add input port"
											onclick={() => addPort(selectedNode.id, 'inputs')}>+</Button
										>
									</div>
									{#each selectedNode.inputs as port (port.id)}
										<div class="port-row">
											<Input
												aria-label={`Input port label: ${port.label}`}
												value={port.label}
												oninput={(event) =>
													updatePort(selectedNode.id, 'inputs', port.id, {
														label: event.currentTarget.value
													})}
											/>
											<Button
												class="mobile-port-action"
												size="sm"
												variant="outline"
												disabled={!armedOutput}
												onclick={() => connectTo(selectedNode.id, port.id)}>Connect</Button
											>
											<Button
												size="sm"
												variant="ghost"
												aria-label={`Remove input port: ${port.label}`}
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
											aria-label="Add output port"
											onclick={() => addPort(selectedNode.id, 'outputs')}>+</Button
										>
									</div>
									{#each selectedNode.outputs as port (port.id)}
										<div class="port-row">
											<Input
												aria-label={`Output port label: ${port.label}`}
												value={port.label}
												oninput={(event) =>
													updatePort(selectedNode.id, 'outputs', port.id, {
														label: event.currentTarget.value
													})}
											/>
											<Button
												class="mobile-port-action"
												size="sm"
												variant="outline"
												aria-pressed={armedOutput?.nodeId === selectedNode.id &&
													armedOutput?.portId === port.id}
												onclick={() => (armedOutput = { nodeId: selectedNode.id, portId: port.id })}
												>Use output</Button
											>
											<Button
												size="sm"
												variant="ghost"
												aria-label={`Remove output port: ${port.label}`}
												onclick={() => removePort(selectedNode.id, 'outputs', port.id)}>×</Button
											>
										</div>
									{/each}
								</div>
							</div>
							<Button variant="destructive" size="sm" onclick={removeSelectedNodes}
								>Remove node</Button
							>
						</div>
					{:else if selectedEdge}
						<div class="panel">
							<h2>Connection details</h2>
							{#if connectionMessage}
								<p role="alert">{connectionMessage}</p>
							{/if}
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
									onchange={(event) => retargetEdge('source', event.currentTarget)}
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
									onchange={(event) => retargetEdge('sourcePort', event.currentTarget)}
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
									onchange={(event) => retargetEdge('target', event.currentTarget)}
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
									onchange={(event) => retargetEdge('targetPort', event.currentTarget)}
								>
									{#each graph.nodes.find((node) => node.id === selectedEdge.target)?.inputs ?? [] as port (port.id)}
										<option value={port.id}>{port.label}</option>
									{/each}
								</select>
							</label>
							<Button
								variant="destructive"
								size="sm"
								onclick={() => disconnectEdge(selectedEdge.id)}
							>
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
				</Tabs.Content>
			</Tabs.Root>
		</aside>
	</div>
</main>
