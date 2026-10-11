<script lang="ts">
	import { onMount } from 'svelte';
	import { GRAPH_TOOL_NAMES } from '$features/architecture-inventory';

	const endpoint = 'https://diagram.manef.dev/api/mcp/server';
	let hydrated = $state(false);
	let message = $state('');
	onMount(() => (hydrated = true));

	async function copyEndpoint() {
		try {
			await navigator.clipboard.writeText(endpoint);
			message = 'Endpoint copied.';
		} catch {
			message = 'Copy was blocked. Select the endpoint below and copy it manually.';
		}
	}
</script>

<div class="card stack mcp-connection">
	<p>Connect an MCP client to Diagram using Streamable HTTP.</p>
	<label for="diagram-mcp-endpoint">MCP endpoint</label>
	<input id="diagram-mcp-endpoint" readonly value={endpoint} />
	<button class="btn" type="button" disabled={!hydrated} onclick={copyEndpoint}
		>Copy MCP endpoint</button
	>
	{#if message}<p role="status">{message}</p>{/if}
	<ol>
		<li>Add a remote MCP server in a client that supports HTTP with custom headers.</li>
		<li>Paste the endpoint above and choose Streamable HTTP.</li>
		<li>
			Ask the deployment owner for a server token. In your client's private configuration, set <code
				>Authorization: Bearer YOUR_SERVER_TOKEN</code
			>.
		</li>
		<li>Refresh the tool list, then run <code>graph_status</code> to check the connection.</li>
	</ol>
	<p class="muted">
		Anonymous requests are rejected. This endpoint uses a bearer token; it does not offer OAuth
		sign-in. Keep the token private and out of shared diagrams.
	</p>
	<details>
		<summary>{GRAPH_TOOL_NAMES.length} read-only graph tools</summary>
		<ul>
			{#each GRAPH_TOOL_NAMES as name (name)}<li><code>{name}</code></li>{/each}
		</ul>
	</details>
	<p class="muted">
		Tools query the public map, trace connections, search public references, and build portable view
		links. Portable views validate the graph supplied by the caller. Tools do not save editor
		changes or access private inventory. The demo workspace's MCP playground is a local simulation.
	</p>
</div>

<style>
	.mcp-connection {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	input {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 0.65rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		color: inherit;
		font-size: 16px;
	}
	button,
	summary {
		min-height: 44px;
	}
	summary {
		cursor: pointer;
		padding: 0.65rem 0;
	}
	ol,
	ul {
		padding-left: 1.5rem;
	}
	li {
		margin: 0.5rem 0;
	}
</style>
