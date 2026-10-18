import {
	documentAsJson,
	documentAsMarkdown,
	parseDiagramDocument,
	parseDiagramMarkdown
} from 'manef:diagram-core';

declare const $input: { all(): { json: unknown }[] };
declare function __manefSetResult(items: unknown[]): void;

const output = $input.all().map((item, index) => {
	const payload = item.json;
	if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
		throw new Error(`Item ${index}: json must be an object with format, source, and target.`);
	}
	const { format, source, target } = payload as Record<string, unknown>;
	if (format !== 'json' && format !== 'md') {
		throw new Error(`Item ${index}: format must be json or md.`);
	}
	if (typeof source !== 'string') {
		throw new Error(`Item ${index}: source must be a string.`);
	}
	if (target !== 'json' && target !== 'md') {
		throw new Error(`Item ${index}: target must be json or md.`);
	}
	try {
		const document =
			format === 'json' ? parseDiagramDocument(source) : parseDiagramMarkdown(source);
		return {
			json: {
				document,
				source: target === 'json' ? documentAsJson(document) : documentAsMarkdown(document),
				format: target
			},
			pairedItem: { item: index }
		};
	} catch (error) {
		const detail = error instanceof Error ? error.message : 'Diagram conversion failed.';
		throw new Error(`Item ${index}: ${detail}`, { cause: error });
	}
});

__manefSetResult(output);
