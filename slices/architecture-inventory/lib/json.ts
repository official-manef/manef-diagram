export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

const MAX_JSON_DEPTH = 100;
const MAX_JSON_VALUES = 200_000;

/** Reject values JSON serialization would silently alter or omit. */
export function isJsonValue(value: unknown): value is JsonValue {
	const ancestors = new Set<object>();
	let count = 0;
	function visit(current: unknown, depth: number): boolean {
		count += 1;
		if (count > MAX_JSON_VALUES || depth > MAX_JSON_DEPTH) return false;
		if (current === null || typeof current === 'string' || typeof current === 'boolean')
			return true;
		if (typeof current === 'number') {
			return (
				Number.isFinite(current) &&
				!Object.is(current, -0) &&
				(!Number.isInteger(current) || Number.isSafeInteger(current))
			);
		}
		if (typeof current !== 'object') return false;
		if (ancestors.has(current)) return false;
		const array = Array.isArray(current);
		const prototype: unknown = Object.getPrototypeOf(current);
		if (
			array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
		)
			return false;
		const keys = Reflect.ownKeys(current);
		if (keys.some((key) => typeof key !== 'string')) return false;
		if (array) {
			if (keys.length !== current.length + 1) return false;
			for (let index = 0; index < current.length; index += 1) {
				if (!Object.hasOwn(current, index)) return false;
			}
		}
		ancestors.add(current);
		for (const key of keys) {
			if (array && key === 'length') continue;
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
			if (!visit(descriptor.value, depth + 1)) return false;
		}
		ancestors.delete(current);
		return true;
	}
	return visit(value, 0);
}

export function cloneJson<T>(value: T): T {
	if (!isJsonValue(value))
		throw new Error(
			'Data must use plain JSON values with finite numbers, safe integers, and no negative zero. Encode larger integers as strings.'
		);
	return JSON.parse(JSON.stringify(value)) as T;
}

/** Object key order is presentation; array order is document content. */
export function sameJson(a: unknown, b: unknown): boolean {
	if (!isJsonValue(a) || !isJsonValue(b)) return false;
	function signature(value: JsonValue): string {
		if (value === null || typeof value !== 'object') return JSON.stringify(value);
		if (Array.isArray(value)) return '[' + value.map(signature).join(',') + ']';
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((key) => JSON.stringify(key) + ':' + signature(value[key]))
				.join(',') +
			'}'
		);
	}
	return signature(a) === signature(b);
}
