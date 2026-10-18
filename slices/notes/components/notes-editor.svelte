<script lang="ts">
	import { useAuth } from 'convex-svelte';
	import { Button } from '$lib/components/ui/button';
	import NotesForm from './notes-form.svelte';

	const auth = useAuth();
</script>

{#if auth.isLoading}
	<p role="status" class="text-sm text-muted-foreground">Checking your sign-in…</p>
{:else if !auth.isAuthenticated}
	<div class="space-y-3">
		<p role="alert" class="text-sm text-destructive">
			Your session expired or the backend could not verify it. Sign in again to open your notes.
		</p>
		<Button href="/auth/login" data-sveltekit-reload>Sign in again</Button>
	</div>
{:else}
	<NotesForm />
{/if}
