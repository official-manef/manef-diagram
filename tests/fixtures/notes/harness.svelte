<script lang="ts">
	import ConvexProvider from '../../../src/lib/components/convex-provider.svelte';
	import { notesFeature } from '$features/notes';
	const screen = notesFeature.loadScreen();
	import { page, session } from './page.svelte';
	import { fixture } from './client.svelte';
</script>

<nav aria-label="Fixture controls">
	<button onclick={() => (page.data.auth.session = session('alice'))}>Use Alice</button>
	<button onclick={() => (page.data.auth.session = session('bob'))}>Use Bob</button>
	<button onclick={() => (page.data.auth.session = null)}>Clear session</button>
	<button onclick={() => fixture.authenticate(false)}>Reject auth</button>
	<button onclick={() => fixture.authenticate(true)}>Confirm auth</button>
	<button onclick={() => fixture.queryFailure(true)}>Fail query</button>
	<button onclick={() => fixture.queryFailure(false)}>Recover query</button>
	<button onclick={() => (fixture.holdMutations = true)}>Hold mutation</button>
	<button onclick={() => fixture.finishMutation()}>Finish mutation</button>
	<button onclick={() => fixture.finishMutation(new Error('private provider payload'))}
		>Fail mutation</button
	>
</nav>
<ConvexProvider url="https://fixture.invalid" session={page.data.auth.session}>
	{#await screen then NotesScreen}<NotesScreen />{/await}
</ConvexProvider>
<output aria-label="Clients closed">{fixture.closedClients}</output>
