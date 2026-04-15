/**
 * Markdown → ANSI 渲染：Bun 环境使用 Bun.markdown.ansi，Node.js 下降级为原始文本。
 */
export function renderMarkdown(md: string): string {
    try {
        // @ts-expect-error Bun-only API; unavailable in Node.js
        return Bun.markdown.ansi(md);
    } catch {
        return md;
    }
}
