import { error } from '@sveltejs/kit';
import { products } from '$features/ecosystem';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const product = products.find((item) => item.id === params.slug);
	if (!product) error(404, 'Product not found');
	return {
		product,
		meta: { title: product.name, description: product.description }
	};
};
