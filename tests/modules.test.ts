import { describe, test, expect } from 'bun:test';
import { MODULES, getModule, getModuleNames, isModuleName } from '../src/modules';
import { findAction, getAvailableActions, resolveActionUrl, resolveModuleCommand } from '../src/modules';
import type { Workspace } from '../src/types/config';

    describe('module registry', () => {
    test('contains expected modules', () => {
        const names = getModuleNames();
        expect(names).toContain('product');
        expect(names).toContain('bug');
        expect(names).toContain('task');
        expect(names).toContain('story');
        expect(names).toContain('user');
        expect(names.length).toBe(19);
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

    test('bug module has no top-level list', () => {
        const bug = getModule('bug')!;
        const listAction = findAction(bug, 'list');
        expect(listAction).toBeDefined();
        expect(listAction!.path).toBe('/{scope}/{scopeID}/bugs');
    });
});

describe('module resolver', () => {
    const workspace: Workspace = {
        id: 1,
        product: { id: 10, name: '产品1' },
        project: { id: 20, name: '项目1' },
        execution: { id: 30, name: '执行1' },
    };

    test('resolves detail path', () => {
        const mod = getModule('product')!;
        const getAction = findAction(mod, 'get')!;
        expect(resolveActionUrl(getAction, { productID: 1 })).toBe('/products/1');
    });

    test('resolves action path', () => {
        const mod = getModule('bug')!;
        const action = findAction(mod, 'action', 'resolve')!;
        expect(resolveActionUrl(action, { bugID: 5 })).toBe('/bugs/5/resolve');
    });

    test('throws for unknown action', () => {
        const mod = getModule('bug')!;
        expect(findAction(mod, 'action', 'nonexistent')).toBeUndefined();
    });

    test('getAvailableActions returns action names', () => {
        const mod = getModule('story')!;
        const actions = getAvailableActions(mod);
        expect(actions).toContain('change');
        expect(actions).toContain('close');
        expect(actions).toContain('activate');
    });

    test('supports positional id for update action', () => {
        const mod = getModule('product')!;
        const command = resolveModuleCommand(
            mod,
            'update',
            {},
            ['1', '--name=产品1'],
        );
        expect(command.id).toBe(1);
        expect(command.path).toBe('/products/1');
        expect(command.data).toEqual({ name: '产品1' });
    });

    test('supports positional id for delete action', () => {
        const mod = getModule('product')!;
        const command = resolveModuleCommand(
            mod,
            'delete',
            {},
            ['1'],
        );
        expect(command.id).toBe(1);
        expect(command.path).toBe('/products/1');
    });
});
