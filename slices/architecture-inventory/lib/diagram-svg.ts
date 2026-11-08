import DOMPurify from 'dompurify';
import { calculate } from 'specificity';

// SVG is display-only: no embedded HTML, scripts, animation, navigation or remote assets.
const FORBIDDEN_TAGS = [
	'script',
	'foreignObject',
	'iframe',
	'object',
	'embed',
	'image',
	'a',
	'animate',
	'animateMotion',
	'animateTransform',
	'set',
	'feImage'
];
const PRESENTATION =
	/^(?:--(?:pele-|_)[\w-]+|fill(?:-opacity|-rule)?|stroke(?:-width|-opacity|-dasharray|-dashoffset|-linecap|-linejoin|-miterlimit)?|opacity|color|background-color|font(?:-family|-size|-weight|-style|-variant)?|text-anchor|text-decoration|dominant-baseline|alignment-baseline|letter-spacing|word-spacing|text-transform|direction|visibility|display|marker-(?:start|mid|end)|stop-color|stop-opacity|rx|ry|max-width|width|height)$/;

function safeValue(value: string): boolean {
	// Reject escapes/comments and all resource references except same-SVG fragment URLs.
	return (
		!/[\\@<>]|\/\*|expression\s*\(/i.test(value) &&
		!value.replace(/url\(\s*["']?#[\w:.-]+["']?\s*\)/gi, '').match(/url\s*\(/i)
	);
}

type Weight = [number, number, number, number, number];
type Declaration = { value: string; weight: Weight; order: number };

function outranks(next: Declaration, previous: Declaration): boolean {
	for (let index = 0; index < next.weight.length; index++) {
		if (next.weight[index] !== previous.weight[index])
			return next.weight[index] > previous.weight[index];
	}
	return next.order >= previous.order;
}

/** Split selector lists without splitting commas inside :is(), :not() or attributes. */
function selectors(text: string): string[] {
	const result: string[] = [];
	let start = 0;
	let depth = 0;
	let quote = '';
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		if (quote) {
			if (char === quote) quote = '';
			continue;
		}
		if (char === '"' || char === "'") quote = char;
		else if (char === '(' || char === '[') depth++;
		else if (char === ')' || char === ']') depth--;
		else if (char === ',' && depth === 0) {
			result.push(text.slice(start, index));
			start = index + 1;
		}
	}
	result.push(text.slice(start));
	return result;
}

/** Browser-only, fail-closed final boundary for BOTH renderer outputs. */
export function sanitizeDiagramSvg(markup: string): DocumentFragment {
	if (markup.length > 2_000_000) throw new Error('Rendered diagram exceeds the SVG size limit.');
	const fragment = DOMPurify.sanitize(markup, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: FORBIDDEN_TAGS,
		RETURN_DOM_FRAGMENT: true
	});
	const svg = fragment.firstElementChild;
	if (fragment.children.length !== 1 || svg?.localName !== 'svg')
		throw new Error('Renderer did not return a single SVG diagram.');
	const elements = [svg, ...svg.querySelectorAll('*')];
	if (elements.length > 10_000) throw new Error('Rendered diagram exceeds the SVG element limit.');
	const winners = new Map<SVGElement, Map<string, Declaration>>();
	let order = 0;
	let candidates = 0;
	let outputBytes = 0;
	let cssBytes = 0;
	let rules = 0;
	let matchingWork = 0;
	function collect(target: SVGElement, source: CSSStyleDeclaration, base: Weight) {
		let properties = winners.get(target);
		if (!properties) {
			properties = new Map();
			winners.set(target, properties);
		}
		for (const name of Array.from(source)) {
			if (++candidates > 100_000) throw new Error('SVG style processing budget exceeded.');
			const value = source.getPropertyValue(name);
			if (!PRESENTATION.test(name) || !safeValue(value)) continue;
			const weight: Weight = [...base];
			weight[0] = source.getPropertyPriority(name) === 'important' ? 1 : 0;
			const candidate = { value, weight, order: order++ };
			const previous = properties.get(name);
			if (!previous || outranks(candidate, previous)) properties.set(name, candidate);
		}
	}
	for (const element of elements) {
		for (const attribute of Array.from(element.attributes)) {
			if (attribute.name === 'style') continue;
			if (
				/^on/i.test(attribute.name) ||
				(/(?:^|:)href$/i.test(attribute.name) && !/^#[\w:.-]+$/.test(attribute.value)) ||
				!safeValue(attribute.value)
			)
				element.removeAttributeNode(attribute);
		}
		if (element instanceof SVGElement) {
			const style = element.style.cssText;
			element.removeAttribute('style');
			const declarations = document.createElement('span').style;
			declarations.cssText = style;
			collect(element, declarations, [0, 1, 0, 0, 0]);
		}
	}
	// Mermaid emits stylesheets. Materialize approved presentation declarations on
	// detached SVG nodes, then discard CSS: it cannot style the surrounding app.
	for (const style of Array.from(svg.querySelectorAll('style'))) {
		const css = style.textContent ?? '';
		style.remove();
		cssBytes += css.length;
		if (cssBytes > 100_000) throw new Error('SVG total stylesheet budget exceeded.');
		// Constructed sheets are detached; @import is ignored by replaceSync.
		// Skip all at-rules (including keyframes), not their safe sibling rules.
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(css);
		rules += sheet.cssRules.length;
		if (rules > 2_000) throw new Error('SVG total CSS rule budget exceeded.');
		for (const rule of Array.from(sheet.cssRules)) {
			if (!(rule instanceof CSSStyleRule)) continue;
			for (const selector of selectors(rule.selectorText)) {
				matchingWork += elements.length;
				if (selector.length > 1_000 || matchingWork > 2_000_000)
					throw new Error('SVG selector processing budget exceeded.');
				let matches: Element[];
				let specificity: ReturnType<typeof calculate>;
				try {
					specificity = calculate(selector);
					matches = [...svg.querySelectorAll(selector)];
					if (svg.matches(selector)) matches.push(svg);
				} catch {
					continue;
				}
				for (const element of matches)
					if (element instanceof SVGElement)
						collect(element, rule.style, [0, 0, specificity.A, specificity.B, specificity.C]);
			}
		}
	}
	for (const [element, properties] of winners) {
		for (const [name, declaration] of properties) {
			outputBytes += name.length + declaration.value.length;
			if (outputBytes > 2_000_000) throw new Error('SVG inline style output budget exceeded.');
			element.style.setProperty(name, declaration.value, declaration.weight[0] ? 'important' : '');
		}
	}
	return fragment;
}
