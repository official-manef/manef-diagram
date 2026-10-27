import { AI_ENABLED, AI_MODELS_JSON } from '$app/env/private';
import { error } from '@sveltejs/kit';
import { requireCapabilityAccess, readJsonBody } from '#lib/server/access.js';
import { parseChat } from '#lib/server/ai/config.js';
import { chatResponse } from '#lib/server/ai/chat.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (AI_ENABLED !== 'true') error(404, 'AI chat is disabled.');
	await requireCapabilityAccess(event);
	const body = await readJsonBody(event.request);
	let input: ReturnType<typeof parseChat>;
	try {
		input = parseChat({ AI_ENABLED, AI_MODELS_JSON }, body);
	} catch {
		error(400, 'Check the approved provider/model, key and conversation limits.');
	}
	return chatResponse(input, event.request.signal);
};
