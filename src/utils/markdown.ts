async function createMarkdownRenderer() {
    const { default: MarkdownIt } = await import('markdown-it');
    const parser = new MarkdownIt({ html: false });
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
