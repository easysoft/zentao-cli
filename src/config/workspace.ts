import type { Profile, Workspace, WorkspaceRef } from '../types/index.js';
import { saveProfile } from './store.js';

export function getCurrentWorkspace(profile: Profile): Workspace | undefined {
    if (!profile.currentWorkspace || !profile.workspaces?.length) return undefined;
    return profile.workspaces.find((w) => w.id === profile.currentWorkspace);
}

export function listWorkspaces(profile: Profile): Workspace[] {
    return profile.workspaces ?? [];
}

export function getWorkspaceById(profile: Profile, id: number): Workspace | undefined {
    return profile.workspaces?.find((w) => w.id === id);
}

export function setCurrentWorkspace(profile: Profile, id: number): boolean {
    const ws = getWorkspaceById(profile, id);
    if (!ws) return false;
    profile.currentWorkspace = id;
    saveProfile(profile);
    return true;
}

function nextWorkspaceId(profile: Profile): number {
    const workspaces = profile.workspaces ?? [];
    if (workspaces.length === 0) return 1;
    return Math.max(...workspaces.map((w) => w.id)) + 1;
}

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
