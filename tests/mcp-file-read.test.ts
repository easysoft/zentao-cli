import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP file/read returns labelled Base64 for binary and empty files in either transport format', async () => {
    const calls: Array<{ path: string; stream: string | null }> = [];
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        const stream = url.searchParams.get('stream');
        calls.push({ path: url.pathname, stream });
        const bytes = url.pathname.endsWith('/7/read') ? Buffer.from([0, 255, 128, 65]) : Buffer.alloc(0);
        return new Response(stream === '1' ? bytes.toString('base64') : bytes);
    }, ['--modules', 'file', '--split-tools', '--read-only']);
    try {
        const help = await mcp.client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'read' } });
        expect(toolData(help).description).toContain('encoding: "base64"');
        const name = 'zentao_file_read';
        const invalid = await mcp.client.callTool({ name, arguments: { action: 'read', id: 7, pick: 'content' } });
        expect(invalid.structuredContent).toMatchObject({ error: { code: 'E2009', action: 'read' } });
        expect(calls).toEqual([]);

        for (const id of [7, 8]) {
            for (const stream of [undefined, 0, 1]) {
                const result = await mcp.client.callTool({ name, arguments: { action: 'read', id, params: { stream } } });
                const expected = { encoding: 'base64', content: id === 7 ? 'AP+AQQ==' : '' };
                expect(result.isError).not.toBe(true);
                expect(result.structuredContent).toEqual({ data: expected });
                expect(toolData(result)).toEqual(expected);
                expect(calls.splice(0)).toEqual([{ path: `/api.php/v2/files/${id}/read`, stream: String(stream ?? 0) }]);
            }
        }
    } finally {
        await mcp.close();
    }
});
