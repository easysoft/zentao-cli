import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { extendModuleAction, type ModuleAction, type ModuleActionRequest } from 'zentao-api';
import { ZentaoError } from '../errors.js';
import { isLocalImageSource, localImageSource } from '../utils/image-source.js';
import { htmlInputFields } from './contract.js';
import { LOCAL_FILE_UPLOAD_UNAVAILABLE, localUploadsBlocked } from './file-policy.js';

interface Range { startOffset: number; endOffset: number }
interface ImageRef {
    src: string;
    alt: string;
    tag: Range;
    attribute: Range;
    local?: Awaited<ReturnType<typeof localImageSource>>;
}

function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function fileImages(html: string): ImageRef[] {
    const nodes: DefaultTreeAdapterTypes.ChildNode[] = [...parseFragment(html, { sourceCodeLocationInfo: true }).childNodes];
    const images: ImageRef[] = [];
    while (nodes.length) {
        const node = nodes.pop()!;
        if (!('tagName' in node)) continue;
        const children = 'content' in node ? node.content.childNodes : node.childNodes;
        for (const child of children) nodes.push(child);
        if (node.tagName !== 'img' || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
        const tag = node.sourceCodeLocation?.startTag;
        const attribute = node.sourceCodeLocation?.attrs?.src;
        const src = node.attrs.find(attr => attr.name === 'src')?.value;
        if (tag && attribute && src && /^file:/i.test(src) && html[tag.endOffset - 1] === '>') {
            images.push({ src, alt: node.attrs.find(attr => attr.name === 'alt')?.value ?? '', tag, attribute });
        }
    }
    return images.sort((a, b) => a.tag.startOffset - b.tag.startOffset);
}

/** Let the SDK process just these tags, then splice its results into the original HTML. */
async function projectField(html: string, images: ImageRef[], paths: Map<string, string>) {
    for (const image of images) {
        if (isLocalImageSource(image.src)) image.local = await localImageSource(image.src, paths);
    }
    const workingHtml = images.map(({ src, alt, local }) => {
        // SDK 0.9 uses alt as the multipart filename. Omit it for local files so
        // repeated paths share the disk filename, MIME type and upload result.
        const hint = !local && alt ? ' alt="' + escapeHtml(alt) + '"' : '';
        return '<img src="' + escapeHtml(local?.url ?? src) + '"' + hint + '>';
    }).join('');

    function restore(processed: string): string {
        const tags = parseFragment(processed).childNodes;
        const parts: string[] = [];
        let offset = 0;
        for (const [index, image] of images.entries()) {
            const node = tags[index];
            const attrs = node && 'tagName' in node && node.tagName === 'img' ? node.attrs : [];
            const src = attrs.find(attr => attr.name === 'src')?.value;
            const local = image.local;
            const failed = local && attrs.some(attr => attr.name === 'alt');
            if (!src || (local && !failed && src === local.url)) {
                throw new ZentaoError('E2014');
            }
            if (failed) {
                parts.push(html.slice(offset, image.tag.startOffset), '图片未上传：', escapeHtml(image.alt.trim() || local.filename));
                offset = image.tag.endOffset;
            } else {
                const { startOffset, endOffset } = image.attribute;
                const attr = html.slice(startOffset, endOffset);
                const prefix = /^[^=]+=\s*/.exec(attr)![0];
                const quote = attr[prefix.length] === "'" ? "'" : '"';
                parts.push(html.slice(offset, startOffset), prefix, quote, escapeHtml(src), quote);
                offset = endOffset;
            }
        }
        parts.push(html.slice(offset));
        return parts.join('');
    }
    return { workingHtml, restore };
}

const suppliedHtmlFields = Symbol('supplied HTML fields');
type ImageParams = Record<string, unknown> & { [suppliedHtmlFields]?: Map<string, boolean> };
type BeforeRequest = NonNullable<ModuleAction['beforeRequest']>;
const imageHooks = new WeakSet<BeforeRequest>();

async function prepareImageBody(command: ModuleActionRequest, data: Record<string, unknown>, fields: string[], inputs: Map<string, boolean>) {
    const hasImage = (value: unknown): value is string => typeof value === 'string'
        && /<img(?=[\t\n\f\r />])/i.test(value) && /file:|&/i.test(value);
    if (!fields.some(field => hasImage(data[field]))) return data;
    const action = command.action;
    const requestBody = action.requestBody!;
    const restorers = new Map<string, (processed: string) => string>();
    const paths = new Map<string, string>();
    const blocked = localUploadsBlocked();
    const working = { ...data };
    for (const [field, supplied] of inputs) {
        const html = data[field];
        if (!hasImage(html) || (!blocked && !supplied)) continue;
        const images = fileImages(html);
        if (!images.some(image => isLocalImageSource(image.src))) continue;
        if (blocked) throw new ZentaoError('E2009', { option: field, reason: LOCAL_FILE_UPLOAD_UNAVAILABLE });
        const { workingHtml, restore } = await projectField(html, images, paths);
        working[field] = workingHtml;
        restorers.set(field, restore);
    }
    // Body validation and autoFill are complete. Limit the SDK file scanner on
    // this request to caller-supplied HTML, including weekly/update.content.
    const properties = Object.fromEntries([...inputs].filter(([, supplied]) => supplied).map(([field]) => [field, { textType: 'html' }]));
    command.action = { ...action, requestBody: { ...requestBody, schema: { ...requestBody.schema, properties } } };
    if (restorers.size) {
        command.action.request = async context => {
            const body = { ...context.request.data };
            for (const [field, restore] of restorers) body[field] = restore(body[field] as string);
            const request = { ...context.request, action, data: body };
            if (action.request) return action.request({ ...context, request, body });
            const { client, timeout, insecure, actionAssistant, bodyType } = context;
            return client.request(request.path, { method: action.method?.toLowerCase() === 'put' ? 'PUT' : 'POST', query: request.query,
                body, bodyType, timeout, insecure, actionAssistant });
        };
    }
    return working;
}

/** The SDK preserves symbol keys across autoFill without serializing them to the API. */
export function setHtmlImageInputs(moduleName: string, action: ModuleAction, params: ImageParams): void {
    if (!action.requestBody || (action.requestBody.mediaType ?? 'application/json') !== 'application/json'
        || !['post', 'put'].includes(action.method?.toLowerCase() ?? '')) return;
    const fields = htmlInputFields(moduleName, action.name);
    if (!fields.length) return;
    const body = (params.data ?? {}) as Record<string, unknown>;
    const nativeDoc = moduleName === 'doc' && (body.contentType ?? params.contentType) !== 'html';
    params[suppliedHtmlFields] = new Map(fields.filter(field => !(nativeDoc && field === 'content'))
        .map(field => [field, Object.hasOwn(body, field) || Object.hasOwn(params, field)]));
    if (action.beforeRequest && imageHooks.has(action.beforeRequest)) return;
    extendModuleAction(moduleName, action.name, original => {
        const beforeRequest: BeforeRequest = async command => {
            const patch = await original.beforeRequest?.(command) ?? {};
            const inputs = (command.params as ImageParams)[suppliedHtmlFields];
            const data = patch.data ?? command.data;
            return inputs && data ? { ...patch, data: await prepareImageBody(command, data, fields, inputs) } : patch;
        };
        imageHooks.add(beforeRequest);
        return { ...original, beforeRequest };
    });
}
