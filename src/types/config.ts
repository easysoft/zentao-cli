export interface WorkspaceRef {
    id: number;
    name: string;
}

export interface Workspace {
    id: number;
    product?: WorkspaceRef;
    project?: WorkspaceRef;
    execution?: WorkspaceRef;
}

export interface UserConfig {
    defaultOutputFormat?: 'markdown' | 'json' | 'raw';
    lang?: string;
    defaultRecPerPage?: number;
    insecure?: boolean;
    timeout?: number;
    htmlToMarkdown?: boolean;
    batchFailFast?: boolean;
    autoSetWorkspace?: boolean;
    pagers?: Record<string, number>;
    silent?: boolean;
}

export interface Profile {
    server: string;
    account: string;
    token: string;
    user?: Record<string, unknown>;
    loginTime: string;
    lastUsedTime: string;
    currentWorkspace?: number;
    workspaces?: Workspace[];
    config?: UserConfig;
}

export interface ConfigData {
    currentProfile?: string;
    profiles?: Profile[];
}

export type OutputFormat = 'markdown' | 'json' | 'raw';
