import { describe, test, expect } from 'bun:test';
import { getModule, getModuleNames, isModuleName, getAllModules, getObjectProps } from '../src/modules';
import { findAction, getAvailableActions, getAction } from '../src/modules';
import { buildParams } from '../src/modules/args';

describe('module registry (zentao-api)', () => {
    test('contains expected modules', () => {
        const names = getModuleNames();
        expect(names).toContain('product');
        expect(names).toContain('bug');
        expect(names).toContain('task');
        expect(names).toContain('story');
        expect(names).toContain('user');
        for (const name of ['issue', 'risk', 'meeting', 'workflow', 'doc', 'todo', 'my']) {
            expect(names).toContain(name);
        }
    });

    test('getAllModules returns every registered module', () => {
        expect(getAllModules().length).toBe(getModuleNames().length);
    });

    test('getModule returns module by name', () => {
        const mod = getModule('product');
        expect(mod).toBeDefined();
        expect(mod!.name).toBe('product');
        const listAction = findAction(mod!, 'list');
        expect(listAction).toBeDefined();
        expect(listAction!.path).toBe('/products');
    });

    test('getModule is case insensitive', () => {
        expect(getModule('Product')).toBeDefined();
        expect(getModule('BUG')).toBeDefined();
    });

    test('getModule returns undefined for unknown module', () => {
        expect(getModule('nonexistent')).toBeUndefined();
    });

    test('getObjectProps returns definitions for a module object', () => {
        const props = getObjectProps('product');
        expect(props.id).toBe('编号');
        expect(props.name).toBe('产品名称');
    });

    test('every registered module has object property definitions', () => {
        for (const name of getModuleNames()) {
            expect(Object.keys(getObjectProps(name)).length).toBeGreaterThan(0);
        }
    });

    test('isModuleName identifies valid modules', () => {
        expect(isModuleName('product')).toBe(true);
        expect(isModuleName('unknown')).toBe(false);
    });

    test('bug module has correct actions', () => {
        const bug = getModule('bug')!;
        const actions = bug.actions.map((a) => a.name);
        expect(actions).toContain('resolve');
        expect(actions).toContain('close');
        expect(actions).toContain('activate');
        expect(actions).toContain('confirm');
    });

    test('task module has correct actions', () => {
        const task = getModule('task')!;
        const actions = task.actions.map((a) => a.name);
        expect(actions).toContain('start');
        expect(actions).toContain('finish');
        expect(actions).toContain('close');
        expect(actions).toContain('activate');
    });

    test('product module has list operation', () => {
        const product = getModule('product')!;
        const listAction = findAction(product, 'list');
        expect(listAction).toBeDefined();
        expect(listAction!.name).toBe('list');
    });

    test('bug module has no top-level list (scoped list)', () => {
        const bug = getModule('bug')!;
        const listAction = findAction(bug, 'list');
        expect(listAction).toBeDefined();
        expect(listAction!.path).toBe('/{scope}/{scopeID}/bugs');
    });
});

describe('action lookup', () => {
    test('getAction resolves ls alias to list', () => {
        const mod = getModule('product')!;
        expect(getAction(mod, 'ls')?.type).toBe('list');
        expect(getAction(mod, 'list')?.type).toBe('list');
    });

    test('getAction resolves extension actions', () => {
        const mod = getModule('bug')!;
        expect(getAction(mod, 'resolve')?.name).toBe('resolve');
        expect(getAction(mod, 'RESOLVE')?.name).toBe('resolve');
    });

    test('getAction returns undefined for unknown action', () => {
        const mod = getModule('bug')!;
        expect(getAction(mod, 'nonexistent')).toBeUndefined();
    });

    test('getAvailableActions returns action names', () => {
        const mod = getModule('story')!;
        const actions = getAvailableActions(mod);
        expect(actions).toContain('change');
        expect(actions).toContain('close');
        expect(actions).toContain('activate');
        expect(actions).toContain('getGrades');
        expect(actions).toContain('updateModule');
        expect(actions).not.toContain('list');
        expect(getAvailableActions(getModule('doc')!)).toContain('createMyDoc');
        expect(getAvailableActions(getModule('my')!)).toContain('tasks');
    });
});

describe('buildParams (argv parsing)', () => {
    test('positional numeric id becomes params.id', () => {
        const params = buildParams({}, 'update', ['1', '--name=产品1']);
        expect(params.id).toBe('1');
        expect(params.name).toBe('产品1');
    });

    test('positional id for delete', () => {
        const params = buildParams({}, 'delete', ['1']);
        expect(params.id).toBe('1');
    });

    test('positional JSON object becomes params.data', () => {
        const params = buildParams({}, 'create', ['{"title":"hi"}']);
        expect(params.data).toBe('{"title":"hi"}');
    });

    test('--params JSON is merged', () => {
        const params = buildParams({ params: '{"severity":2}' }, 'create', []);
        expect(params.severity).toBe(2);
    });

    test('--key=value coerces basic types', () => {
        const params = buildParams({}, 'create', ['--num=3', '--flag=true', '--name=foo']);
        expect(params.num).toBe(3);
        expect(params.flag).toBe(true);
        expect(params.name).toBe('foo');
    });

    test.each(['\n', '\r\n', '\r', '\u2028', '\u2029'])('preserves text with line separator %j and surrounding fields', (newline) => {
        const desc = `第一行=a${newline}第二行=b${newline}`;
        expect(buildParams({}, 'update', ['123', '--story=1794', `--desc=${desc}`, '--deadline=2026-09-19'])).toEqual({
            id: '123', story: 1794, desc, deadline: '2026-09-19',
        });
        expect(buildParams({}, 'update', [`--desc=123${newline}`]).desc).toBe(`123${newline}`);
    });

    test('splits only at the first equals sign and preserves empty values', () => {
        expect(buildParams({}, 'update', ['--desc=a=b=c', '--name=', '--flag=false', '--custom.field-name=x'])).toEqual({
            desc: 'a=b=c', name: '', flag: false, 'custom.field-name': 'x',
        });
    });

    test.each(['--desc', 'unexpected', '--=value', '--bad key=value', '--desc\n=value'])('rejects malformed arguments instead of ignoring %j', (arg) => {
        expect(() => buildParams({}, 'update', [arg])).toThrow(expect.objectContaining({ code: '2009' }));
    });
});
