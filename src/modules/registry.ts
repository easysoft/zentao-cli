import type { ModuleDefinition } from '../types/index.js';

export const MODULES: Record<string, ModuleDefinition> = {
    user: {
        name: 'user',
        pluralKey: 'users',
        singularKey: 'user',
        basePath: '/users',
        idParam: 'userID',
        operations: ['list', 'get', 'create', 'update', 'delete'],
        listScopes: [],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    program: {
        name: 'program',
        pluralKey: 'programs',
        singularKey: 'program',
        basePath: '/programs',
        idParam: 'programID',
        operations: ['list', 'get', 'create', 'update', 'delete'],
        listScopes: [],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    product: {
        name: 'product',
        pluralKey: 'products',
        singularKey: 'product',
        basePath: '/products',
        idParam: 'productID',
        operations: ['list', 'get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'program', path: '/programs/:programID/products' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    project: {
        name: 'project',
        pluralKey: 'projects',
        singularKey: 'project',
        basePath: '/projects',
        idParam: 'projectID',
        operations: ['list', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'program', path: '/programs/:programID/projects' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    execution: {
        name: 'execution',
        pluralKey: 'executions',
        singularKey: 'execution',
        basePath: '/executions',
        idParam: 'executionID',
        operations: ['list', 'get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'project', path: '/projects/:projectID/executions' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    productplan: {
        name: 'productplan',
        pluralKey: 'productplans',
        singularKey: 'productplan',
        basePath: '/productplans',
        idParam: 'planID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/productplans' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    story: {
        name: 'story',
        pluralKey: 'stories',
        singularKey: 'story',
        basePath: '/stories',
        idParam: 'storyID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/stories' },
            { parent: 'project', path: '/projects/:projectID/stories' },
            { parent: 'execution', path: '/executions/:executionID/stories' },
        ],
        actions: [
            { name: 'change', method: 'put', idParam: 'storyID' },
            { name: 'close', method: 'put', idParam: 'storyID' },
            { name: 'activate', method: 'put', idParam: 'storyID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    epic: {
        name: 'epic',
        pluralKey: 'epics',
        singularKey: 'epic',
        basePath: '/epics',
        idParam: 'epicID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/epics' },
        ],
        actions: [
            { name: 'change', method: 'put', idParam: 'epicID' },
            { name: 'close', method: 'put', idParam: 'epicID' },
            { name: 'activate', method: 'put', idParam: 'epicID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    requirement: {
        name: 'requirement',
        pluralKey: 'requirements',
        singularKey: 'requirement',
        basePath: '/requirements',
        idParam: 'requirementID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/requirements' },
        ],
        actions: [
            { name: 'change', method: 'put', idParam: 'requirementID' },
            { name: 'close', method: 'put', idParam: 'requirementID' },
            { name: 'activate', method: 'put', idParam: 'requirementID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    bug: {
        name: 'bug',
        pluralKey: 'bugs',
        singularKey: 'bug',
        basePath: '/bugs',
        idParam: 'bugID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/bugs' },
            { parent: 'project', path: '/projects/:projectID/bugs' },
            { parent: 'execution', path: '/executions/:executionID/bugs' },
        ],
        actions: [
            { name: 'resolve', method: 'put', idParam: 'bugID' },
            { name: 'close', method: 'put', idParam: 'bugID' },
            { name: 'activate', method: 'put', idParam: 'bugID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    testcase: {
        name: 'testcase',
        pluralKey: 'testcases',
        singularKey: 'testcase',
        basePath: '/testcases',
        idParam: 'caseID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/testcases' },
            { parent: 'project', path: '/projects/:projectID/testcases' },
            { parent: 'execution', path: '/executions/:executionID/testcases' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    task: {
        name: 'task',
        pluralKey: 'tasks',
        singularKey: 'task',
        basePath: '/tasks',
        idParam: 'taskID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'execution', path: '/executions/:executionID/tasks' },
        ],
        actions: [
            { name: 'start', method: 'put', idParam: 'taskID' },
            { name: 'finish', method: 'put', idParam: 'taskID' },
            { name: 'close', method: 'put', idParam: 'taskID' },
            { name: 'activate', method: 'put', idParam: 'taskID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    feedback: {
        name: 'feedback',
        pluralKey: 'feedbacks',
        singularKey: 'feedback',
        basePath: '/feedbacks',
        idParam: 'feedbackID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/feedbacks' },
        ],
        actions: [
            { name: 'close', method: 'put', idParam: 'feedbackID' },
            { name: 'activate', method: 'put', idParam: 'feedbackID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    ticket: {
        name: 'ticket',
        pluralKey: 'tickets',
        singularKey: 'ticket',
        basePath: '/tickets',
        idParam: 'ticketID',
        operations: ['get', 'create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/tickets' },
        ],
        actions: [
            { name: 'close', method: 'put', idParam: 'ticketID' },
            { name: 'activate', method: 'put', idParam: 'ticketID' },
        ],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    system: {
        name: 'system',
        pluralKey: 'systems',
        singularKey: 'system',
        basePath: '/systems',
        idParam: 'systemID',
        operations: ['create', 'update'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/systems' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    build: {
        name: 'build',
        pluralKey: 'builds',
        singularKey: 'build',
        basePath: '/builds',
        idParam: 'buildID',
        operations: ['create', 'update', 'delete'],
        listScopes: [
            { parent: 'project', path: '/projects/:projectID/builds' },
            { parent: 'execution', path: '/executions/:executionID/builds' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    testtask: {
        name: 'testtask',
        pluralKey: 'testtasks',
        singularKey: 'testtask',
        basePath: '/testtasks',
        idParam: 'testtaskID',
        operations: ['create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/testtasks' },
            { parent: 'project', path: '/projects/:projectID/testtasks' },
            { parent: 'execution', path: '/executions/:executionID/testtasks' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    release: {
        name: 'release',
        pluralKey: 'releases',
        singularKey: 'release',
        basePath: '/releases',
        idParam: 'releasID',
        operations: ['create', 'update', 'delete'],
        listScopes: [
            { parent: 'product', path: '/products/:productID/releases' },
        ],
        actions: [],
        queryParams: ['browseType', 'orderBy', 'recPerPage', 'pageID'],
    },
    file: {
        name: 'file',
        pluralKey: 'files',
        singularKey: 'file',
        basePath: '/files',
        idParam: 'fileID',
        operations: ['create', 'delete'],
        listScopes: [],
        actions: [],
        queryParams: [],
    },
};

export function getModule(name: string): ModuleDefinition | undefined {
    return MODULES[name.toLowerCase()];
}

export function getModuleNames(): string[] {
    return Object.keys(MODULES);
}

export function isModuleName(name: string): boolean {
    return name.toLowerCase() in MODULES;
}
