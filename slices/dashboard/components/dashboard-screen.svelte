<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { defaultGraph } from '$features/architecture-inventory';
	import { FeatureGrid, HorizontalRail, SignalBanner } from '$lib/components/app-ui';
</script>

<div class="space-y-5">
	<SignalBanner title="The public map lives on the diagram">
		{defaultGraph.nodes.length} services are drawn with labeled connections. Hosts that are not in that
		list stay off the map until you add them there.
		<Button class="mt-3" href="/app">Open diagram</Button>
	</SignalBanner>

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
</div>
