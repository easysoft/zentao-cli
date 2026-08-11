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
        expect(names.length).toBe(19);
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
});
