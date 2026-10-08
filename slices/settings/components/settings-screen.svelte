<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		DisclosureCard,
		FeatureGrid,
		SegmentedControl,
		SignalBanner,
		type SegmentItem
	} from '$lib/components/app-ui';

	const sections = [
		{ id: 'workspace', label: 'Workspace' },
		{ id: 'interface', label: 'Interface' }
	] as const satisfies readonly SegmentItem[];
	let section = $state('workspace');
	let workspaceName = $state('MANEF map');
	const cleanWorkspaceName = $derived(workspaceName.trim() || 'Untitled workspace');
</script>

<div class="space-y-5">
	<SegmentedControl items={sections} bind:value={section} label="Settings section" />

	{#if section === 'workspace'}
		<FeatureGrid density="wide">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex flex-wrap items-center gap-2"
						>Workspace <Badge variant="secondary">{cleanWorkspaceName}</Badge></Card.Title
					>
					<Card.Description
						>This name stays in this browser tab. It resets when you leave or reload. It does not
						rename the public map.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<label for="workspace-name" class="text-sm font-medium">Workspace name</label>
					<Input id="workspace-name" class="mt-2 w-full" bind:value={workspaceName} />
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header
					><Card.Title>Public map</Card.Title><Card.Description
						>The diagram at /app is the product. These pages are the surrounding tools.</Card.Description
					></Card.Header
				>
				<Card.Content class="space-y-3 text-sm">
					<p class="text-muted-foreground">
						Production origin is diagram.manef.dev. Sign-in on the public site is MANEF, not a
						separate Google button.
					</p>
					<Button href="/app">Open diagram</Button>
				</Card.Content>
			</Card.Root>
		</FeatureGrid>

		<DisclosureCard summary="How the map stays one product">
			<p class="text-sm leading-6 text-muted-foreground">
				Keep the public service list in the diagram seed. Do not paste private inventory into that
				seed. Repeated pages stay registered once.
			</p>
		</DisclosureCard>
	{:else}
		<SignalBanner title="The diagram is the interface">
			Desktop shows the labeled map. A phone shows the same services as a list with full names.
			Settings on this page do not change that layout.
		</SignalBanner>
		<FeatureGrid density="compact">
			<Card.Root
				><Card.Header
					><Card.Title>Labeled lines</Card.Title><Card.Description
						>Each connection has its own name, such as context graph, shell, or private operations.</Card.Description
					></Card.Header
				></Card.Root
			>
			<Card.Root
				><Card.Header
					><Card.Title>Readable phone map</Card.Title><Card.Description
						>Service names stay full size. The canvas is not shrunk to fit the width.</Card.Description
					></Card.Header
				></Card.Root
			>
			<Card.Root
				><Card.Header
					><Card.Title>Direct neighbors</Card.Title><Card.Description
						>Selecting a service keeps its neighbors bright and dims the rest of the map.</Card.Description
					></Card.Header
				></Card.Root
			>
			<Card.Root
				><Card.Header
					><Card.Title>Local name only</Card.Title><Card.Description
						>The workspace name on the other tab stays in this browser. It does not rename the
						public map.</Card.Description
					></Card.Header
				></Card.Root
			>
		</FeatureGrid>
	{/if}
</div>
