import { expect, mock, test } from 'bun:test';
import type { ServerConfig } from 'zentao-api';
import { runPageLink, type PageLinkInput } from '../src/api/page-links.js';

const server = 'https://zentao.example.test/zentao';
const config: ServerConfig = {
    version: '23.0', systemMode: 'ALM', sprintConcept: '0', sessionVar: 'sid', requestType: 'GET',
    requestFix: '_', moduleVar: 'module', methodVar: 'method', viewVar: 'view',
    webRoot: '/work/', instCode: 'tenant', router: '/entry.php',
};
const create: PageLinkInput = { action: 'create', module: 'bug', method: 'view', vars: ['id=7', 'q=中_&=%2F'] };

test.each([
    ['GET', '/entry.php?module=bug&method=view&id=7&q=%E4%B8%AD_%26%3D%252F'],
    ['PATH_INFO', '/work/tenant/bug_view_7_%E4%B8%AD%5F%26%3D%252F.html'],
    ['PATH_INFO2', '/entry.php/bug_view_7_%E4%B8%AD%5F%26%3D%252F.html'],
])('creates and auto-detects %s links offline using the configured router and installation path', async (requestType, path) => {
    const profile = { server, serverConfig: { ...config, requestType }, get token(): never { throw Error('unexpected credential access'); } };
    const load = mock(async () => config);
    const link = await runPageLink(profile, create, load);
    expect(link).toBe(new URL(path, server).href);
    expect(await runPageLink(profile, { ...create, relative: true }, load)).toBe(path);
    expect(await runPageLink({ server, serverConfig: config }, { action: 'parse', url: path }, load)).toMatchObject({
        moduleName: 'bug', methodName: 'view', requestType,
        vars: requestType === 'GET' ? [['id', '7'], ['q', '中_&=%2F']] : [['', '7'], ['', '%E4%B8%AD%5F%26%3D%252F']],
    });
    expect(load).not.toHaveBeenCalled();
});

test('retains variable order, empty values, and repeated names in GET mode', async () => {
    expect(await runPageLink({ server, serverConfig: config }, {
        ...create, vars: ['q=', 'q=a=b', 'q=%2F'], relative: true,
    }, async () => config)).toBe('/entry.php?module=bug&method=view&q=&q=a%3Db&q=%252F');
});

test('escapes slashes in variables for slash-based routing and rejects dot-segment traversal', async () => {
    const profile = { server, serverConfig: { ...config, requestType: 'PATH_INFO', requestFix: '/' } };
    const load = mock(async () => config);
    expect(await runPageLink(profile, { ...create, vars: ['q=design/ui'], relative: true }, load))
        .toBe('/work/tenant/bug/view/design%2Fui.html');
    await expect(runPageLink(profile, { ...create, vars: ['q=..', 'id=7'] }, load)).rejects.toMatchObject({ code: '2009' });
    expect(load).not.toHaveBeenCalled();
});

test('loads the bound configuration once for a legacy profile, including a custom external-to-webRoot entrypoint', async () => {
    const profile = { server, serverConfig: { version: '22.5' } as ServerConfig };
    for (const input of [create, { action: 'parse', url: '/entry.php?module=bug&method=view' }] as const) {
        const load = mock(async () => config);
        const result = await runPageLink(profile, input, load);
        if (input.action === 'create') expect(result).toBeString();
        else expect(result).toMatchObject({ moduleName: 'bug', methodName: 'view', requestType: 'GET' });
        expect(load).toHaveBeenCalledTimes(1);
    }
    const incomplete = mock(async () => profile.serverConfig);
    await expect(runPageLink(profile, create, incomplete)).rejects.toMatchObject({ code: '2009', message: expect.stringContaining('requestType') });
    expect(incomplete).toHaveBeenCalledTimes(1);
});

test('classifies external links without fetching any routing configuration', async () => {
    const load = mock(async () => config);
    for (const url of ['https://elsewhere.example.test/a', '//elsewhere.example.test/', 'mailto:qa@example.test']) {
        expect(await runPageLink({ server }, { action: 'parse', url }, load)).toEqual({ external: true, url });
    }
    expect(load).not.toHaveBeenCalled();
});

test('rejects invalid sites, credential-bearing URLs, and malformed variables before configuration discovery', async () => {
    const load = mock(async () => config);
    for (const site of ['/relative', 'ftp://site.test', 'https://qa:example-secret@site.test', 'https://site.test/?example-secret', 'https://site.test/#example-secret']) {
        await expect(runPageLink({ server: site }, create, load)).rejects.toMatchObject({ code: '2009',
            message: expect.not.stringContaining('example-secret') });
    }
    for (const input of [
        { action: 'parse', url: 'https://qa:example-secret@elsewhere.test/' },
        { ...create, vars: ['no-assignment'] }, { ...create, vars: ['=value'] },
    ] satisfies PageLinkInput[]) {
        await expect(runPageLink({ server }, input, load)).rejects.toMatchObject({ code: '2009' });
    }
    expect(load).not.toHaveBeenCalled();
});
