import { extendModuleAction } from 'zentao-api';

// zentao-api 0.8.0 declares a mixed-case default outside this action's enum.
extendModuleAction('my', 'auditPlans', (action) => {
    action.params = action.params?.map(param => param.name === 'browseType' && param.defaultValue === 'myChecking'
        ? { ...param, defaultValue: 'mychecking', description: param.description?.replace('默认 myChecking', '默认 mychecking') }
        : param);
    return action;
});

// SDK 0.8.2 accepts explicit statuses here, but its schemas still omit the field.
for (const module of ['story', 'requirement', 'epic']) {
    for (const name of ['create', 'change']) {
        extendModuleAction(module, name, (action) => {
            const properties = action.requestBody!.schema.properties as Record<string, unknown>;
            properties.status ??= {
                type: 'string',
                description: '无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。',
            };
            return action;
        });
    }
}

// Some servers read the product ID for bug creation from the query string.
// Copy the resolved body value so JSON/stdin precedence and SDK coercion agree.
extendModuleAction('bug', 'create', (action) => {
    const beforeRequest = action.beforeRequest;
    action.beforeRequest = async (request) => {
        const patch = await beforeRequest?.(request);
        const resolved = { ...request, ...patch };
        if (resolved.data?.productID === undefined) return patch ?? {};
        return {
            ...patch,
            query: { ...resolved.query, productID: resolved.data.productID },
        };
    };
    return action;
});
