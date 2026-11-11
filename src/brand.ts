/** Build-time product identity. This module must remain usable in browsers. */
export interface CliBrandConfig {
    displayName: string;
    commandName: string;
    packageName: string;
    homepage: string;
    logo?: string;
    repository: string | null;
}

export interface ResolvedBrand extends CliBrandConfig {
    logoSvg?: string;
}

declare const BUILD_BRAND: ResolvedBrand | undefined;
export const brand: ResolvedBrand | undefined = typeof BUILD_BRAND === 'undefined' ? undefined : BUILD_BRAND;

/** Only pass product-owned text, or tag a template so interpolated data stays intact. */
export function brandText(text: string | TemplateStringsArray, ...values: unknown[]): string {
    if (typeof text !== 'string') return text.reduce((result, part, index) => result + brandText(part) + (index < values.length ? String(values[index]) : ''), '');
    return formatBrandText(text, brand);
}

export function formatBrandText(text: string, config?: ResolvedBrand): string {
    if (!config) return text;
    const brand = config;
    return text
        .replace(/https:\/\/www\.zentao\.net\//g, brand.homepage)
        .replace(/zentao-api/g, '\u0000sdk\u0000')
        .replace(/ZenTao-Action-Assistant/g, '\u0000assistant-header\u0000')
        .replace(/zentao-cli/g, brand.packageName)
        .replace(/禅道|禪道|ZenTao|Zentao/g, brand.displayName)
        .replace(/ZENTAO/g, brand.commandName.toUpperCase())
        .replace(/zentao/g, brand.commandName)
        .replace(/\u0000sdk\u0000/g, 'zentao-api')
        .replace(/\u0000assistant-header\u0000/g, 'ZenTao-Action-Assistant');
}

const metadataCaches = new WeakMap<ResolvedBrand, WeakMap<object, unknown>>();
/** Read-only presentation projection; never apply this to API responses. */
export function brandMetadata<T>(value: T, example = false, config = brand): T {
    if (!config || value === null || typeof value !== 'object') return (example && typeof value === 'string' ? formatBrandText(value, config) : value) as T;
    let metadataCache = metadataCaches.get(config);
    if (!metadataCache) metadataCaches.set(config, metadataCache = new WeakMap());
    if (!example && metadataCache.has(value)) return metadataCache.get(value) as T;
    const copy = Array.isArray(value)
        ? value.map(item => brandMetadata(item, example, config))
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
            typeof item === 'string' && (example || ['display', 'description', 'label', 'title'].includes(key))
                ? formatBrandText(item, config)
                : brandMetadata(item, example || key === 'examples' || key === 'example', config),
        ]));
    Object.freeze(copy);
    if (!example) metadataCache.set(value, copy);
    return copy as T;
}

/** SVG is read and validated by the build, never loaded from disk at runtime. */
export function brandLogo(fallback: string, className: string): string {
    return brand?.logoSvg ? brand.logoSvg.replace('<svg ', `<svg class="${className}" aria-hidden="true" `) : fallback;
}

/** Like brandText, preserving raw backslashes in embedded browser scripts. */
export function brandRaw(parts: TemplateStringsArray, ...values: unknown[]): string {
    return parts.raw.reduce((result, part, index) => result + brandText(part) + (index < values.length ? String(values[index]) : ""), "");
}
