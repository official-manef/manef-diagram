<script lang="ts">
	import PublicFrame from './public-frame.svelte';
	import { auditRows } from './catalog';
</script>

<PublicFrame>
	<main class="public-main public-section stack">
		<p class="eyebrow">3 Oct 2026 snapshot, read against the live map</p>
		<h1>Implementation audit</h1>
		<p class="lead">
			Deployment READY is not feature acceptance. Rows keep the evidence and the gap.
		</p>
		<div class="card" style="padding: 0; overflow: auto">
			<table>
				<thead>
					<tr>
						<th>Area</th>
						<th>Check</th>
						<th>Level</th>
						<th>Evidence</th>
						<th>Source</th>
						<th>Still open</th>
					</tr>
				</thead>
				<tbody>
					{#each auditRows as row (row.id)}
						<tr>
							<td>{row.area}</td>
							<td>{row.check}</td>
							<td><span class="pill">{row.level}</span></td>
							<td>{row.evidence}</td>
							<td class="muted">{row.source}</td>
							<td>{row.open}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</main>
</PublicFrame>
