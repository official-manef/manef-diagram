import {
	PUBLIC_SITE_URL,
	PUBLIC_SEO_INDEXABLE,
	PUBLIC_GOOGLE_SITE_VERIFICATION,
	PUBLIC_BING_SITE_VERIFICATION,
	PUBLIC_TWITTER_SITE
} from '$app/env/public';
import { seoSettings, sitemapDocument } from '#lib/config/metadata.js';

export function GET() {
	return new Response(
		sitemapDocument(
			seoSettings({
				PUBLIC_SITE_URL,
				PUBLIC_SEO_INDEXABLE,
				PUBLIC_GOOGLE_SITE_VERIFICATION,
				PUBLIC_BING_SITE_VERIFICATION,
				PUBLIC_TWITTER_SITE
			})
		),
		{
			headers: { 'Content-Type': 'application/xml; charset=utf-8' }
		}
	);
}
