import type { Profile, Workspace, WorkspaceRef } from '../types/index.js';
import { saveProfile } from './store.js';

/**
 * 确保 Profile 任意时刻都有一个“当前工作区”可用。
 * - 若完全没有工作区，则创建一个空工作区并设为当前
 * - 若有工作区但 currentWorkspace 缺失/无效，则切到第一个工作区
 */
export function ensureCurrentWorkspace(profile: Profile): Workspace {
    if (!profile.workspaces) profile.workspaces = [];

    const byId =
        profile.currentWorkspace
            ? profile.workspaces.find((w) => w.id === profile.currentWorkspace)
            : undefined;
    if (byId) return byId;

    if (profile.workspaces.length > 0) {
        profile.currentWorkspace = profile.workspaces[0].id;
        saveProfile(profile);
        return profile.workspaces[0];
    }

    return createWorkspace(profile, {});
}

/** 获取 Profile 当前激活的工作区（始终返回一个可用工作区） */
export function getCurrentWorkspace(profile: Profile): Workspace {
    return ensureCurrentWorkspace(profile);
}

/** 列出 Profile 下所有工作区 */
export function listWorkspaces(profile: Profile): Workspace[] {
    ensureCurrentWorkspace(profile);
    return profile.workspaces ?? [];
}

/** 根据 ID 查找工作区 */
export function getWorkspaceById(profile: Profile, id: number): Workspace | undefined {
    return profile.workspaces?.find((w) => w.id === id);
}

/** 将指定 ID 的工作区设为当前工作区，不存在时返回 false */
export function setCurrentWorkspace(profile: Profile, id: number): boolean {
    const ws = getWorkspaceById(profile, id);
    if (!ws) return false;
    profile.currentWorkspace = id;
    saveProfile(profile);
    return true;
}

/** 在现有工作区 ID 中取最大值 +1，保证本地 ID 单调递增 */
function nextWorkspaceId(profile: Profile): number {
    const workspaces = profile.workspaces ?? [];
    if (workspaces.length === 0) return 1;
    return Math.max(...workspaces.map((w) => w.id)) + 1;
}

/** 创建新工作区并设为当前工作区，自动分配递增 ID */
export function createWorkspace(
    profile: Profile,
    params: { product?: WorkspaceRef; project?: WorkspaceRef; execution?: WorkspaceRef },
): Workspace {
    if (!profile.workspaces) profile.workspaces = [];
    const ws: Workspace = {
        id: nextWorkspaceId(profile),
        product: params.product,
        project: params.project,
        execution: params.execution,
    };
    profile.workspaces.push(ws);
    profile.currentWorkspace = ws.id;
    saveProfile(profile);
    return ws;
}

/**
 * 查找匹配的工作区，不存在则创建。
 * 匹配规则：对传入的每一层引用（product/project/execution），若调用方提供了该层，则要求与工作区中对应层的 ID 一致；未提供的层不参与比较。
 */
export function findOrCreateWorkspace(
    profile: Profile,
    params: { product?: WorkspaceRef; project?: WorkspaceRef; execution?: WorkspaceRef },
): Workspace {
    const existing = profile.workspaces?.find((w) => {
        if (params.product && w.product?.id !== params.product.id) return false;
        if (params.project && w.project?.id !== params.project.id) return false;
        if (params.execution && w.execution?.id !== params.execution.id) return false;
        return true;
    });
    if (existing) {
        profile.currentWorkspace = existing.id;
        saveProfile(profile);
        return existing;
    }
    return createWorkspace(profile, params);
}

/**
 * 按 ID 更新工作区中的产品/项目/执行引用，并写回磁盘。
 * @returns 更新后的工作区；ID 不存在时返回 `undefined`
 */
export function updateWorkspace(
    profile: Profile,
    id: number,
    updates: Partial<Omit<Workspace, 'id'>>,
): Workspace | undefined {
    const ws = getWorkspaceById(profile, id);
    if (!ws) return undefined;
    Object.assign(ws, updates);
    saveProfile(profile);
    return ws;
}
