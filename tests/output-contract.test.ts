import { expect, test } from 'bun:test';
import { formatOutput, formatTable, formatTerminalTable, formatList } from '../src/utils/format.js';
import { executeModuleCommand } from '../src/modules/executor.js';
import { getModule } from '../src/modules/helper.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { ZentaoClient } from '../src/api/index.js';
test('JSON envelopes are stable for list, detail and scalar results', () => {
    for (const data of [[], { id: 1 }, 'done', null]) {
        expect(JSON.parse(formatOutput(data, { format: 'json', isList: Array.isArray(data) }))).toMatchObject({ ok: true, data, meta: expect.any(Object) });
    }
});
test('automatic columns use literal union keys and scalar arrays get one column', () => {
    const table = formatTable([{ 'task.name': 'First' }, { other: 'Later' }]);
    expect(table).toContain('First'); expect(table).toContain('Later');
    expect(formatList({ 'task.name': 'Literal' })).toContain('Literal');
    expect(formatTable(['one', 'two'])).toContain('| one |');
    expect(formatTable([])).toBe('0 条');
    expect(formatTerminalTable([{ name: 'x'.repeat(100) }])).toContain('…');
});
test('JSON retains HTML and unknown angle brackets; human output only converts rich text fields', async () => {
    const product = { id: 1, name: 'Use <widget> here', desc: '<p>Rich</p>' };
    const client = { getZentaoConfig: async () => ({ version: '22.7' }), request: async () => ({ product }) } as unknown as ZentaoClient;
    const json = await executeModuleCommand(client, getModule('product')!, 'get', ['1'], { format: 'json' }, DEFAULT_CONFIG);
    expect(json.data).toEqual(product);
    const human = await executeModuleCommand(client, getModule('product')!, 'get', ['1'], { format: 'markdown' }, DEFAULT_CONFIG);
    expect(human.data).toEqual({ ...product, desc: 'Rich' });
});
