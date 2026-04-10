import { describe, test, expect } from 'bun:test';
import { MODULES, getModule, getModuleNames, isModuleName } from '../src/modules/registry';
import { resolveListPath, resolveDetailPath, resolveActionPath, getAvailableActions } from '../src/modules/resolver';
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
        expect(mod!.pluralKey).toBe('products');
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
        expect(product.operations).toContain('list');
    });

    test('bug module has no top-level list', () => {
        const bug = getModule('bug')!;
        expect(bug.operations).not.toContain('list');
        expect(bug.listScopes.length).toBeGreaterThan(0);
    });
});

describe('module resolver', () => {
    const workspace: Workspace = {
        id: 1,
        product: { id: 10, name: '产品1' },
        project: { id: 20, name: '项目1' },
        execution: { id: 30, name: '执行1' },
    };

    test('resolves top-level list path for product', () => {
        const mod = getModule('product')!;
        const path = resolveListPath(mod);
        expect(path).toBe('/products');
    });

    test('resolves scoped list path for bug with workspace', () => {
        const mod = getModule('bug')!;
        const path = resolveListPath(mod, workspace);
        // Should prefer execution scope
        expect(path).toBe('/executions/30/bugs');
    });

    test('resolves scoped list path with explicit product param', () => {
        const mod = getModule('bug')!;
        const path = resolveListPath(mod, undefined, { product: 5 });
        expect(path).toBe('/products/5/bugs');
    });

    test('resolves scoped list path with explicit project param', () => {
        const mod = getModule('bug')!;
        const path = resolveListPath(mod, undefined, { project: 7 });
        expect(path).toBe('/projects/7/bugs');
    });

    test('throws when no workspace for scoped module', () => {
        const mod = getModule('bug')!;
        expect(() => resolveListPath(mod)).toThrow();
    });

    test('resolves detail path', () => {
        const mod = getModule('product')!;
        expect(resolveDetailPath(mod, 1)).toBe('/products/1');
    });

    test('resolves action path', () => {
        const mod = getModule('bug')!;
        expect(resolveActionPath(mod, 'resolve', 5)).toBe('/bugs/5/resolve');
    });

    test('throws for unknown action', () => {
        const mod = getModule('bug')!;
        expect(() => resolveActionPath(mod, 'nonexistent', 1)).toThrow();
    });

    test('getAvailableActions returns action names', () => {
        const mod = getModule('story')!;
        const actions = getAvailableActions(mod);
        expect(actions).toContain('change');
        expect(actions).toContain('close');
        expect(actions).toContain('activate');
    });

    test('task list resolves under execution', () => {
        const mod = getModule('task')!;
        const path = resolveListPath(mod, workspace);
        expect(path).toBe('/executions/30/tasks');
    });

    test('product list path under program with explicit param', () => {
        const mod = getModule('product')!;
        const path = resolveListPath(mod, undefined, { program: 3 });
        expect(path).toBe('/programs/3/products');
    });
});
