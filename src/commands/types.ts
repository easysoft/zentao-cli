export interface GlobalOptions {
    format?: string;
    silent?: boolean;
    insecure?: boolean;
    timeout?: number;
}

export interface DataOptions {
    format?: string;
    pick?: string;
    filter?: string[];
    sort?: string;
    search?: string[];
    searchFields?: string;
    page?: string;
    recPerPage?: string;
    all?: boolean;
    limit?: string;
    data?: string;
    yes?: boolean;
    silent?: boolean;
    batchFailFast?: boolean;
    product?: string;
    project?: string;
    execution?: string;
}
