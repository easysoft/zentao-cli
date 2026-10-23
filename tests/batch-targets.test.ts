import { expect, test } from 'bun:test';
import { handleModuleCommand } from '../src/commands/module-handler.js';
import { getModule } from '../src/modules/helper.js';
import { mockProfile } from './helpers.js';
import type { ZentaoClient } from '../src/api/index.js';

test('rejects unsafe target sets before any request', async () => {
    let requests = 0;
    const client = { getZentaoConfig: async () => { requests++; return { version: '22.5' }; } } as unknown as ZentaoClient;
    for (const [action, args, options] of [
        ['create', [], { ids: '1,2' }], ['create', [], { id: '1,2' }],
        ['list', [], { ids: '1,2' }], ['list', [], { id: '1,2' }],
        ['delete', ['1,2'], {}], ['delete', ['--productID=1,2'], {}],
        ['delete', ['1'], { ids: '2,3' }], ['delete', [], { ids: '1,x,2' }],
        ['delete', [], { ids: '1,,2' }], ['delete', [], { ids: '9007199254740992' }],
    ] as const) {
        await expect(handleModuleCommand(client, getModule('product')!, action, [...args], mockProfile,
            { ...options, yes: true, silent: true })).rejects.toMatchObject({ code: '2009' });
    }
    expect(requests).toBe(0);
});
