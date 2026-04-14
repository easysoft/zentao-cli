import { ModuleAction, ModuleActionResultRender, ModuleActionResultRenderType } from "../types";

function renderActionResult(result: unknown, type: ModuleActionResultRenderType, action: ModuleAction): string {
    if (typeof result === 'object' && result && typeof (result as {status: string}).status === 'string') {
        result = (result as {status: string}).status;
    }
    if (typeof result === 'string') {
        return `${action.display ?? '操作'}${result === 'success' ? '成功' : '失败'}`;
    }
    return JSON.stringify(result);
}

export const moduleActionResultRenders: Record<string, ModuleActionResultRender> = {
    action: renderActionResult,
};
