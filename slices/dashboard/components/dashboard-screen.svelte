<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { defaultGraph } from '$features/architecture-inventory';
	import {
		DisclosureCard,
		FeatureGrid,
		HorizontalRail,
		SegmentedControl,
		SignalBanner,
		type SegmentItem
	} from '$lib/components/app-ui';

	const modes = [
		{ id: 'architecture', label: 'Architecture' },
		{ id: 'interaction', label: 'Interaction kit' }
	] as const satisfies readonly SegmentItem[];
	let mode = $state('architecture');
</script>

<div class="space-y-5">
	<SignalBanner title="The public map lives on the diagram">
		{defaultGraph.nodes.length} services are drawn with labeled connections. Hosts that are not in that
		list stay off the map until you add them there.
		<Button class="mt-3" href="/app">Open diagram</Button>
	</SignalBanner>

	{#if mode === 'architecture'}
		<HorizontalRail label="Public services" desktopGrid>
			{#each defaultGraph.nodes as node (node.id)}
				<Card.Root class="min-w-0">
					<Card.Header class="gap-2 p-4 sm:p-5">
						<Badge variant="secondary" class="w-fit">{node.status ?? 'active'}</Badge>
						<Card.Title class="text-xl sm:text-2xl">{node.label}</Card.Title>
						<Card.Description>{node.subtitle}</Card.Description>
					</Card.Header>
					<Card.Content>
						<Button variant="outline" href={`/app?seed=${node.id}&trace=direct`}
							>Show neighbors</Button
						>
					</Card.Content>
				</Card.Root>
			{/each}
		</HorizontalRail>
	{/if}

	<SegmentedControl items={modes} bind:value={mode} label="Dashboard reference mode" />

	{#if mode === 'architecture'}
		<FeatureGrid density="compact">
			<article class="rounded-xl border bg-muted/30 p-4">
				<p class="text-sm font-semibold">Flow</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Services sit in columns. Each line carries its relationship name.
				</p>
			</article>
			<article class="rounded-xl border bg-muted/30 p-4">
				<p class="text-sm font-semibold">Graph</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The busiest service sits in the middle. Spokes reach the others without crossing cards.
				</p>
			</article>
			<article class="rounded-xl border bg-muted/30 p-4">
				<p class="text-sm font-semibold">Phone</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The same services become a full-width list. Names are not scaled down.
				</p>
			</article>
		</FeatureGrid>
	{:else}
		<FeatureGrid density="comfortable">
			<Card.Root>
				<Card.Header
					><Card.Title>Adaptive grid</Card.Title><Card.Description
						>Uses CSS auto-fit/minmax instead of one fixed breakpoint column count.</Card.Description
					></Card.Header
				>
			</Card.Root>
			<Card.Root>
				<Card.Header
					><Card.Title>Overflow-aware rail</Card.Title><Card.Description
						>Horizontal snap is intentional on small screens and becomes a grid when space returns.</Card.Description
					></Card.Header
				>
			</Card.Root>
			<Card.Root>
				<Card.Header
					><Card.Title>Measured viewport snap</Card.Title><Card.Description
						>ResizeObserver marks only sections near a full content viewport as vertical snap
						targets.</Card.Description
					></Card.Header
				>
			</Card.Root>
			<DisclosureCard summary="Why this stays dynamic">
				<p class="text-sm leading-6 text-muted-foreground">
					The primitives publish structural intent. Feature slices supply content, while CSS decides
					how many columns fit and runtime measurement decides whether vertical snap is appropriate.
				</p>
			</DisclosureCard>
		</FeatureGrid>
	{/if}
</div>
