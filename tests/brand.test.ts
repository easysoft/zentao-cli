import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ZentaoError as SdkError } from 'zentao-api';
import { Command } from 'commander';
import { loadBrand, outputDirectory, brandDocument } from '../scripts/brand-config.js';

const directory = mkdtempSync(join(tmpdir(), 'cli-brand-test-'));
const config = { displayName: 'Example', commandName: 'example', packageName: 'example-cli', homepage: 'https://example.com/', repository: null, logoSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>' };
let branded: typeof import('./brand-fixture.js');
beforeAll(async () => {
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    const result = await Bun.build({ entrypoints: [resolve('tests/brand-fixture.ts')], outdir: directory, minify: true, target: 'node', packages: 'external', define: { BUILD_BRAND: JSON.stringify(config), BUILD_VERSION: '"0.0.0"' } });
    expect(result.success).toBe(true);
    branded = await import(join(directory, 'brand-fixture.js'));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test('brand templates preserve interpolated business values', () => {
    expect(branded.brandText`禅道服务：${'禅道 zentao'}`).toBe('Example服务：禅道 zentao');
    expect(branded.brandText('ZENTAO_CONFIG_FILE zentao-cli ZenTao')).toBe('EXAMPLE_CONFIG_FILE example-cli Example');
    expect(branded.brandText('ZenTao-Action-Assistant')).toBe('ZenTao-Action-Assistant');
});

test('branded operation headers use ASCII build identity even with a non-Latin display name', async () => {
    const outdir = join(directory, 'unicode');
    const result = await Bun.build({ entrypoints: [resolve('tests/brand-fixture.ts')], outdir, minify: true, target: 'node', packages: 'external',
        define: { BUILD_BRAND: JSON.stringify({ ...config, displayName: '示例' }), BUILD_VERSION: '"1.2.3"' } });
    expect(result.success).toBe(true);
    const unicode = await import(join(outdir, 'brand-fixture.js')) as typeof branded;
    const seen: Array<string | null> = [];
    const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        seen.push(req.headers.get('ZenTao-Action-Assistant'));
        return Response.json({});
    } });
    try {
        await branded.createClient(api.url.origin).get('/products');
        await unicode.createClient(api.url.origin).get('/products');
        await unicode.createClient(api.url.origin, undefined, { actionAssistant: unicode.resolveAssistant(undefined, true, 'http') }).get('/products');
        await unicode.createClient(api.url.origin, undefined, { actionAssistant: 'AI <custom>' }).get('/products');
        expect(seen).toEqual(['example CLI <example-cli 0.0.0>', 'example CLI <example-cli 1.2.3>',
            'AI <example-cli 1.2.3, mcp: http>', 'AI <custom>']);
        expect(brandDocument('ZenTao-Action-Assistant', { ...config, displayName: '示例' })).toBe('ZenTao-Action-Assistant');
    } finally { api.stop(true); }
});

test('the full command tree and upgrade target use the built brand', () => {
    const program = new Command().name('example');
    branded.registerAllCommands(program);
    let count = 0;
    function visit(command: Command) {
        expect(command.helpInformation()).not.toMatch(/禅道|禪道|zentao/i);
        count++;
        for (const child of command.commands) visit(child);
    }
    visit(program);
    expect(count).toBeGreaterThan(40);
    expect(branded.buildInstallCommand('npm', '0.4.3')).toEqual({ cmd: 'npm', args: ['install', '-g', 'example-cli@0.4.3'] });
});

test('metadata projection changes descriptions without changing protocol or registry values', () => {
    const source = Object.freeze({ name: 'zentao', description: '禅道', enum: ['zentao'], default: '禅道', examples: [{ path: '/tmp/zentao.txt' }], schema: { properties: { description: { type: 'string', description: '禅道说明' } } } });
    const result = branded.brandMetadata(source);
    expect(String(result.description)).toBe('Example');
    expect(result.name).toBe('zentao'); expect(result.enum).toEqual(['zentao']); expect(result.default).toBe('禅道');
    expect(result.schema.properties.description.description).toBe('Example说明');
    expect(result.examples[0].path).toBe('/tmp/example.txt');
    expect(source.description).toBe('禅道'); expect(branded.brandMetadata(source)).toBe(result);
    for (const mod of branded.getAllModules()) for (const action of mod.actions) {
        expect(JSON.stringify(branded.getModuleActionParams(mod.name, action.name).map(p => [p.description, p.options?.map(o => o.label)]))).not.toMatch(/禅道|禪道|zentao/i);
    }
});

test('SDK structured parameters preserve colons and product names', () => {
    const error = branded.mapSdkError(new SdkError('E_INVALID_PARAM', { param: 'name', value: '禅道:https://zentao.example.com/a:b' })) as Error;
    expect(error.message).toContain('禅道:https://zentao.example.com/a:b');
    const server = branded.mapSdkError(new SdkError('E_API_FAILED', { message: '禅道 zentao 原始错误' }, { message: '禅道 zentao 原始错误' })) as Error;
    expect(server.message).toStartWith('Example服务端'); expect(server.message).toContain('禅道 zentao 原始错误');
    const local = branded.mapSdkError(new SdkError('E_INVALID_BASE_URL')) as Error;
    expect(local.message).toContain('Example'); expect(local.message).not.toContain('ZenTao');
    const literal = branded.mapSdkError(new SdkError('E_INVALID_PARAM', { param: 'zentao$&{value}', value: '禅道$`$\'' })) as Error;
    expect(literal.message).toBe('zentao$&{value} 参数值 禅道$`$\' 无效，请检查参数格式是否正确');
});

test('minified browser serializers remain self contained and preserve user inputs', () => {
    const html = branded.renderMcpStartPage({ url: 'https://zentao.example.com/', nonce: 'test', key: 'test' });
    expect(html).toContain('接入Example MCP'); expect(html).toContain('https://zentao.example.com/');
    expect(html).not.toContain('github.com/easysoft/');
    expect(html).toContain('viewBox="0 0 10 10"');
    const serializer = html.match(/const makeConfig = ([\s\S]+?);\s*const makePrompt =/)!;
    expect(serializer).not.toBeNull();
    const makeConfig = new Function('return (' + serializer[1] + ')')();
    const output = JSON.parse(makeConfig('claude', 'https://zentao.example.com/', 'zentao-secret'));
    expect(output.mcpServers['example-remote'].url).toBe('https://zentao.example.com/');
    expect(output.mcpServers['example-remote'].headers.token).toBe('zentao-secret');
});

test('brand builds reject unsafe config and output paths', () => {
    const file = join(directory, 'brand.json');
    writeFileSync(file, JSON.stringify({ ...config, commandName: '../bad' })); expect(() => loadBrand(file)).toThrow();
    expect(() => outputDirectory(process.cwd(), process.cwd())).toThrow();
    expect(() => outputDirectory(resolve('docs'), process.cwd())).toThrow();
    expect(brandDocument('[指南](https://github.com/easysoft/zentao-cli/blob/main/docs/errors.md#错误)', config)).toBe('[指南](docs/errors.md#错误)');
});

test('removing repository links preserves adjacent controls with multiline HTML tags', () => {
    const html = '<a href="https://github.com/easysoft/zentao-cli">GitHub</a\n  ><button class="theme-toggle">Theme</button><a href="#guide">Guide</a>';
    expect(brandDocument(html, config)).toBe('<button class="theme-toggle">Theme</button><a href="#guide">Guide</a>');
    expect(brandDocument('License.<span data-repository-only>Source on GitHub.</span><!-- repository-only:start -->Contribute<!-- repository-only:end -->', config)).toBe('License.');
});
