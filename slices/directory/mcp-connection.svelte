<script lang="ts">
	import { onMount } from 'svelte';
	import { GRAPH_TOOL_NAMES } from '$features/architecture-inventory';

	const endpoint = 'https://diagram.manef.dev/api/mcp/server';
	const codexConfig = `[mcp_servers.diagram]
url = "${endpoint}"
bearer_token_env_var = "MCP_DIAGRAM_TOKEN"`;
	let hydrated = $state(false);
	let message = $state('');
	onMount(() => (hydrated = true));

	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			message = `${label} copied.`;
		} catch {
			message = 'Copy was blocked. Select the endpoint or configuration text and copy it manually.';
		}
	}
</script>

<div class="card stack mcp-connection">
	<p>Connect an MCP client to Diagram using Streamable HTTP.</p>
	<label for="diagram-mcp-endpoint">MCP endpoint</label>
	<input id="diagram-mcp-endpoint" readonly value={endpoint} />
	<button class="btn" type="button" disabled={!hydrated} onclick={() => copy(endpoint, 'Endpoint')}
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
		<summary>Set up Codex with the new token</summary>
		<ol>
			<li>
				Request the current token privately from the deployment owner. Use the replacement token
				after a rotation.
			</li>
			<li>
				Set <code>MCP_DIAGRAM_TOKEN</code> in the environment of the computer running Codex. Its
				value must match the server's private <code>MCP_SERVER_TOKEN</code>.
			</li>
			<li>
				Add the configuration below once to <code>~/.codex/config.toml</code>. It references the
				token without storing its value.
			</li>
			<li>
				Fully quit and relaunch Codex from that environment, or start the CLI in that shell. A
				running app does not inherit a token set in another terminal.
			</li>
			<li>
				Refresh MCP tools: expect the ten names below. Call <code>graph_status</code> with
				<code>{'{}'}</code>, then use <code>graph_list_nodes</code> to get IDs for traces and views.
			</li>
		</ol>
		<label for="diagram-codex-config">Codex MCP configuration (no token included)</label>
		<textarea id="diagram-codex-config" readonly rows="4" value={codexConfig}></textarea>
		<button
			class="btn"
			type="button"
			disabled={!hydrated}
			onclick={() => copy(codexConfig, 'Codex configuration')}>Copy Codex configuration</button
		>
		<p>
			Windows PowerShell: run this to enter the token without putting it in command history, then
			launch Codex from the same shell.
		</p>
		<pre><code
				>$env:MCP_DIAGRAM_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host 'Diagram token' -AsSecureString)).Password</code
			></pre>
		<p class="muted">
			401: check the replacement token and restart the client. 429: wait at least one minute before
			retrying. Initialization and notifications also count toward the process-local 20
			requests/minute limit. Use bearer configuration; <code>codex mcp login</code> is for OAuth.
		</p>
	</details>
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
	input,
	textarea {
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
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	button,
	summary {
		min-height: 44px;
	}
	summary {
		cursor: pointer;
		padding: 0.65rem 0;
	}
	li {
		margin: 0.5rem 0;
	}
</style>
