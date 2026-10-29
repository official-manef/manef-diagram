import {
	PUBLIC_SITE_URL,
	PUBLIC_SEO_INDEXABLE,
	PUBLIC_GOOGLE_SITE_VERIFICATION,
	PUBLIC_BING_SITE_VERIFICATION,
	PUBLIC_TWITTER_SITE
} from '$app/env/public';
import { robotsDocument, seoSettings } from '#lib/config/metadata.js';

export function GET() {
	return new Response(
		robotsDocument(
			seoSettings({
				PUBLIC_SITE_URL,
				PUBLIC_SEO_INDEXABLE,
				PUBLIC_GOOGLE_SITE_VERIFICATION,
				PUBLIC_BING_SITE_VERIFICATION,
				PUBLIC_TWITTER_SITE
			})
		),
		{
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		}
	);
}
