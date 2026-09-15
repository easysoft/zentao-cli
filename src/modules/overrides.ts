import { extendModuleAction } from 'zentao-api';

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
