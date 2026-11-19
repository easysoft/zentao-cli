import type { RuleInline } from 'markdown-it/lib/parser_inline.mjs';
import { isLocalImageSource } from './image-source.js';

/** Accept file destinations specifically inside inline images, using Markdown's own label and title parsers. */
const fileImage: RuleInline = (state, silent) => {
    const { src, pos, posMax, md } = state;
    if (!src.startsWith('![', pos)) return false;
    const labelEnd = md.helpers.parseLinkLabel(state, pos + 1, false);
    if (labelEnd < 0 || src[labelEnd + 1] !== '(') return false;
    const skipSpace = (from: number) => {
        while (from < posMax && /[ \t\n]/.test(src[from])) from++;
        return from;
    };
    const destination = md.helpers.parseLinkDestination(src, skipSpace(labelEnd + 2), posMax);
    if (!destination.ok || !(isLocalImageSource(destination.str) || /^file:\d+$/i.test(destination.str))) return false;
    let end = skipSpace(destination.pos);
    let title = '';
    if (end > destination.pos && src[end] !== ')') {
        const parsed = md.helpers.parseLinkTitle(src, end, posMax);
        if (!parsed.ok) return false;
        title = parsed.str;
        end = skipSpace(parsed.pos);
    }
    if (end >= posMax || src[end] !== ')') return false;
    if (!silent) {
        const token = state.push('image', 'img', 0);
        token.attrs = [['src', destination.str], ['alt', '']];
        if (title) token.attrSet('title', title);
        token.content = src.slice(pos + 2, labelEnd);
        token.children = [];
        md.inline.parse(token.content, md, state.env, token.children);
    }
    state.pos = end + 1;
    return true;
};

async function createMarkdownRenderer() {
    const { default: MarkdownIt } = await import('markdown-it');
    const parser = new MarkdownIt({ html: false });
    parser.inline.ruler.before('image', 'zentao_file_image', fileImage);
    return (value: string): string => {
        const env = {};
        const tokens = parser.parse(value, env);
        // A standalone paragraph is stored as an inline fragment in rich-text fields.
        if (tokens.length === 3 && tokens[0].type === 'paragraph_open'
            && tokens[1].type === 'inline' && tokens[2].type === 'paragraph_close') {
            return parser.renderer.renderInline(tokens[1].children!, parser.options, env);
        }
        return parser.renderer.render(tokens, parser.options, env);
    };
}

let renderer: ReturnType<typeof createMarkdownRenderer> | undefined;

export function getMarkdownRenderer() {
    return renderer ??= createMarkdownRenderer();
}
