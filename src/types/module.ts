export type Operation = 'list' | 'get' | 'create' | 'update' | 'delete';

export interface ParentScope {
    parent: 'program' | 'product' | 'project' | 'execution';
    path: string;
}

export interface ActionDefinition {
    name: string;
    method: 'put' | 'post';
    idParam: string;
}

export interface ModuleDefinition {
    name: string;
    pluralKey: string;
    singularKey: string;
    basePath: string;
    idParam: string;
    operations: Operation[];
    listScopes: ParentScope[];
    actions: ActionDefinition[];
    queryParams: string[];
}
