<script lang="ts">
	import { ProductScreen } from '$features/ecosystem';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ProductScreen product={data.product} />
