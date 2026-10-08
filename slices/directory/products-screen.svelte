<script lang="ts">
	import { resolve } from '$app/paths';
	import PublicFrame from './public-frame.svelte';
	import { products } from './catalog';

	let query = $state('');
	let level = $state('all');
	const visible = $derived(
		products.filter((product) => {
			const hay = `${product.name} ${product.description} ${product.status}`.toLowerCase();
			return (
				(level === 'all' || product.level === level) && hay.includes(query.trim().toLowerCase())
			);
		})
	);
</script>

<PublicFrame>
	<main class="public-main">
		<section class="public-section">
			<p class="eyebrow">Directory</p>
			<h1 style="margin: 10px 0">Products and proposed surfaces</h1>
			<p class="lead">
				Maturity is evidence, not a pricing tier. Proposed means the host is not claimed live.
			</p>
			<div class="row wrap" style="margin: 18px 0">
				<label class="search">
					<span class="muted">Search</span>
					<input aria-label="Search products" bind:value={query} />
				</label>
				<select aria-label="Maturity" bind:value={level}>
					<option value="all">All</option>
					<option value="source">Source</option>
					<option value="external">Existing product</option>
					<option value="proposed">Proposed</option>
				</select>
			</div>
			<div class="grid3">
				{#each visible as product (product.id)}
					<a class="card product-card" href={resolve('/products/[slug]', { slug: product.id })}>
						<span class="mark {product.color}">{product.name.slice(0, 1)}</span>
						<h3>{product.name}</h3>
						<p>{product.description}</p>
						<span class="pill">{product.status}</span>
					</a>
				{:else}
					<p class="notice">No product matches that filter.</p>
				{/each}
			</div>
		</section>
	</main>
</PublicFrame>
