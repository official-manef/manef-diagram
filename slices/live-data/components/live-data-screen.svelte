<script lang="ts">
	import { env } from '$env/dynamic/public';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { FeatureGrid, SignalBanner, ViewportSnapSection } from '$lib/components/app-ui';
	import LiveStatus from './live-status.svelte';
	const configured = Boolean(env.PUBLIC_CONVEX_URL);
</script>

<div class="space-y-5">
	{#if configured}
		<SignalBanner title="Convex URL configured">
			The public diagram does not depend on this connection. The result below only says whether this
			optional backend responded.
		</SignalBanner>
		<FeatureGrid density="comfortable">
			<LiveStatus />
			<Card.Root>
				<Card.Header
					><Card.Title>Optional backend</Card.Title><Card.Description
						>Realtime data is off unless this deployment is linked. The public map still loads.</Card.Description
					></Card.Header
				>
				<Card.Content class="text-sm leading-6 text-muted-foreground"
					>Notes can use this connection later. The diagram you open from the home page does not
					read it.</Card.Content
				>
			</Card.Root>
		</FeatureGrid>
	{:else}
		<SignalBanner title="No live feed on the public map">
			The diagram works without Convex. Link a deployment only when notes or saved graphs need it.
		</SignalBanner>
		<ViewportSnapSection>
			<FeatureGrid density="comfortable">
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex flex-wrap items-center gap-2"
							>Convex is ready to link <Badge variant="outline">Not configured</Badge></Card.Title
						>
						<Card.Description
							>The frontend still builds cleanly before a Convex deployment exists.</Card.Description
						>
					</Card.Header>
					<Card.Content class="space-y-3 text-sm text-muted-foreground">
						<p>
							The public map stays available. To store notes, run
							<code class="rounded bg-muted px-1.5 py-0.5">bunx convex dev</code>
							and set <code>PUBLIC_CONVEX_URL</code>.
						</p>
						<p>Do not point this app at another product's deployment just to fill this page.</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header
						><Card.Title>After linking</Card.Title><Card.Description
							>Keep the data boundary typed and server-authorized.</Card.Description
						></Card.Header
					>
					<Card.Content class="text-sm leading-6 text-muted-foreground"
						>Regenerate Convex types after adding functions, and keep growing reads indexed and
						bounded.</Card.Content
					>
				</Card.Root>
			</FeatureGrid>
		</ViewportSnapSection>
	{/if}
</div>
