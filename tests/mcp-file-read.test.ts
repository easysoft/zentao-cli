import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP file/get accepts a Base64 gid as one URL segment and keeps other file IDs numeric', async () => {
    const gid = '+/8=';
    const paths: string[] = [];
    const file = { id: 42, gid, title: 'example.png' };
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        paths.push(url.pathname);
        return Response.json({ file });
    }, ['--modules', 'file']);
    try {
        for (const action of ['read', 'update', 'delete']) {
            const params = { fileID: gid, ...(action === 'update' ? { fileName: 'new.png' } : {}) };
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: { action, params } });
            expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009', action } } });
        }
        expect(paths).toEqual([]);
        const cases = [
            { input: { params: { fileID: gid } }, segment: '%2B%2F8%3D' },
            { input: { params: { fileID: '1e03' } }, segment: '1e03' },
            { input: { params: { fileID: 42 } }, segment: '42' },
            { input: { id: 42 }, segment: '42' },
        ];
        for (const { input, segment } of cases) {
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: { action: 'get', ...input } });
            expect(result.structuredContent).toEqual({ data: file });
            expect(paths.splice(0)).toEqual([`/api.php/v2/files/${segment}`]);
        }
    } finally {
        await mcp.close();
    }
});

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
