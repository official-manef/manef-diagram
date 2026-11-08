import DOMPurify from 'dompurify';

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

function copyStyle(target: SVGElement, source: CSSStyleDeclaration, original?: Set<string>) {
	for (const name of Array.from(source)) {
		const value = source.getPropertyValue(name);
		if (PRESENTATION.test(name) && safeValue(value) && !original?.has(name))
			target.style.setProperty(name, value);
	}
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
	const originals = new Map<SVGElement, Set<string>>();
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
			copyStyle(element, declarations);
			originals.set(element, new Set(Array.from(element.style)));
		}
	}
	// Mermaid emits stylesheets. Materialize approved presentation declarations on
	// detached SVG nodes, then discard CSS: it cannot style the surrounding app.
	for (const style of Array.from(svg.querySelectorAll('style'))) {
		const css = style.textContent ?? '';
		style.remove();
		if (css.length > 100_000 || /[\\@<>]|\/\*/.test(css)) continue;
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(css);
		if (sheet.cssRules.length > 2_000) throw new Error('Rendered diagram has too many CSS rules.');
		for (const rule of Array.from(sheet.cssRules)) {
			if (!(rule instanceof CSSStyleRule)) continue;
			try {
				const matches = [...svg.querySelectorAll(rule.selectorText)];
				if (svg.matches(rule.selectorText)) matches.push(svg);
				for (const element of matches)
					if (element instanceof SVGElement) copyStyle(element, rule.style, originals.get(element));
			} catch {
				/* Ignore invalid selectors; never reinterpret CSS as markup. */
			}
		}
	}
	return fragment;
}
