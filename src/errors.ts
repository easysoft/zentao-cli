import { ERRORS as SDK_ERRORS, type FileWarning } from 'zentao-api';
import { brandText } from './brand.js';
/**
 * 错误码与默认消息映射表。
 * 消息模板中的 {key} 占位符会在构造 ZentaoError 时被替换为实际值。
 */
export const ERROR_CODES = {
    // 认证与配置 (10xx)
    E1001: brandText('必须提供有效的禅道服务地址、用户名和密码或 TOKEN'),
    E1002: brandText('所提供的禅道服务地址 {url} 无法访问'),
    E1003: '当前用户名和密码不正确',
    E1004: '所提供的 Token 已失效，请提供密码重新登录，或提供新的 TOKEN',
    E1005: '配置文件损坏或无法读取，请检查 {path}',
    E1006: brandText('未找到可用的用户配置，请执行 `zentao login --web` 在浏览器中登录；终端登录使用 `zentao login --no-browser`'),
    E1007: brandText('指定的用户配置不存在，请通过 `zentao profile list` 查看可用配置'),
    E1008: '浏览器登录已取消',
    E1009: brandText('浏览器登录等待超时，请重新执行 `zentao login --web`'),
    E1010: brandText('无法启动本地登录服务，请检查本机网络权限，或使用 `zentao login --no-browser`'),
    E1011: '配置文件写入失败，请检查 {path} 的目录权限和磁盘空间',
    E1012: brandText('未能确认远端会话已撤销，已保留本地登录记录，请重试或联系禅道管理员'),
    E1013: 'Token 所属账号为 {actual}，与指定账号 {account} 不一致',

    // API 调用 (20xx)
    E2001: brandText('未找到指定的模块 {module}，请通过 `zentao help` 查看支持的模块'),
    E2002: '未找到指定的对象 {object}，请检查对象 ID 是否正确',
    E2003: brandText('缺少必要参数 {fields}，请通过 `zentao {module} --help` 查看必要参数'),
    E2004: '{field} 参数值 {value} 无效，请检查参数格式是否正确',
    E2005: brandText('不支持的操作，请通过 `zentao {module} --help` 查看支持的操作'),
    E2006: '当前用户没有权限执行此操作',
    E2007: '`--data` 参数中的 JSON 数据格式无效',
    E2008: brandText('禅道服务端返回错误（Url：{url}，Status：{status}），请查看详细错误信息：{serverResponse}'),
    E2009: '选项 {option} 的值无效，{reason}',
    E2010: brandText('操作 {action} 不支持当前禅道版本 {version}，最低版本要求：{minVersion}，请升级对应系列的禅道版本'),
    E2011: brandText('无法识别禅道版本 {version}，仅支持点分数字的正式版本（如 22.5、biz13.5、max8.5、ipd5.5）'),
    E2012: brandText('无法识别禅道服务端配置，请检查站点根地址的 ?mode=getconfig 是否返回包含 version 的 JSON 对象'),
    E2013: '无法解析富文本图片引用 {path}',
    E2014: '上传响应未提供有效的附件 ID',
    E2015: '图片上传期间登录会话已改变，本次操作已中止',
    E2016: '服务端未确认本次对象的保存结果',

    // 网络通信 (50xx)
    E5001: brandText('请求超时，请检查网络连接或禅道服务是否正常'),
    E5002: brandText('SSL/TLS 证书验证失败，请检查禅道服务地址是否正确'),
    E5003: '请求已取消',
    E5004: '无法启动 MCP HTTP 服务：{reason}',
    E5005: '无法写入附件 {path}：{reason}',
} as const;

/** 错误码类型，限定为 ERROR_CODES 中定义的 key */
export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * 禅道 CLI 统一错误类。
 * 所有可预期的错误（认证、API、数据处理、网络）均通过此类抛出，
 * 便于在命令层统一捕获并按输出格式渲染。
 */
export class ZentaoError extends Error {
    /** 数字错误码（不含前缀 E），如 '1001' */
    code: string;
    /** 附加的错误详情，如禅道服务端返回的原始响应 */
    details?: unknown;

    /**
     * @param code 错误码，如 'E1001'
     * @param replacements 消息模板占位符替换值，如 { url: 'https://...' }
     * @param details 附加详情，会在 JSON 输出中包含
     */
    constructor(code: ErrorCode, replacements?: Record<string, string>, details?: unknown) {
        const message = interpolate(ERROR_CODES[code], replacements);
        super(message);
        this.name = brandText('ZentaoError');
        this.code = code.replace('E', '');
        this.details = details;
    }
}

/** zentao-api SDK 抛出的错误形态（结构性鸭子类型，避免直接 instanceof 跨实例问题） */
interface SdkErrorLike {
    name?: string;
    code?: string;
    message?: string;
    params?: Readonly<Record<string, string | number>>;
    details?: unknown;
}

function isSdkError(error: unknown): error is SdkErrorLike {
    if (!error || typeof error !== 'object') return false;
    const code = (error as SdkErrorLike).code;
    return typeof code === 'string' && code.startsWith('E_');
}

function isFileID(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isFileUid(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && !/[^A-Za-z0-9_-]/.test(value);
}

/** Extract only documented SDK fields for callers reconciling a file batch. */
export function fileRecoveryDetails(details: unknown): { uid?: string; fileIDs?: number[]; fileWarnings?: FileWarning[] } | undefined {
    if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;
    const data = details as Record<string, unknown>;
    const uid = isFileUid(data.uid) ? data.uid : undefined;
    const fileIDs = Array.isArray(data.fileIDs) ? data.fileIDs.filter(isFileID) : [];
    const fileWarnings: FileWarning[] = [];
    if (Array.isArray(data.fileWarnings)) {
        for (const item of data.fileWarnings) {
            if (!item || typeof item !== 'object') continue;
            const { stage, code, message } = item;
            if ((stage !== 'resolve' && stage !== 'upload' && stage !== 'cleanup')
                || typeof code !== 'string' || typeof message !== 'string') continue;
            const warning: FileWarning = { stage, code, message };
            for (const field of ['field', 'path', 'name', 'objectType'] as const) {
                if (typeof item[field] === 'string') warning[field] = item[field];
            }
            if (isFileID(item.fileID)) warning.fileID = item.fileID;
            if (isFileID(item.objectID)) warning.objectID = item.objectID;
            if (isFileUid(item.uid)) warning.uid = item.uid;
            fileWarnings.push(warning);
        }
    }
    if (!uid && !fileIDs.length && !fileWarnings.length) return undefined;
    return {
        ...(uid && { uid }),
        ...(fileIDs.length > 0 && { fileIDs }),
        ...(fileWarnings.length > 0 && { fileWarnings }),
    };
}

/**
 * 将 `zentao-api` SDK 抛出的 {@link import('zentao-api').ZentaoError}（字符串错误码）
 * 映射为 CLI 自身的 {@link ZentaoError}（E-codes，中文消息）。
 *
 * - 已经是 CLI `ZentaoError` 的直接返回；
 * - 非 SDK 错误原样返回，交由上层兜底处理。
 */
export function mapSdkError(error: unknown): unknown {
    if (error instanceof ZentaoError) return error;
    if (!isSdkError(error)) return error;

    const { code, message, details } = error;
    const params = error.params ?? {};
    const d = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>;

    switch (code) {
        case 'E_HTTP_ERROR': {
            const status = Number(d.status);
            const url = typeof d.url === 'string' ? d.url : '';
            if (status === 401) return new ZentaoError('E1004', undefined, details);
            if (status === 403) return new ZentaoError('E2006', undefined, details);
            if (status === 404) return new ZentaoError('E2002', { object: url }, details);
            return new ZentaoError('E2008', {
                url,
                status: String(d.status ?? ''),
                serverResponse: typeof d.body === 'string' ? d.body : String(d.body ?? ''),
            }, details);
        }
        case 'E_TIMEOUT':
            return new ZentaoError('E5001', undefined, details);
        case 'E_ABORTED':
            return new ZentaoError('E5003', undefined, details);
        case 'E_NETWORK_ERROR': {
            const msg = (typeof (d as { message?: unknown }).message === 'string'
                ? (d as { message: string }).message
                : message) ?? '';
            if (msg.includes('SSL') || msg.includes('TLS') || msg.includes('certificate')) {
                return new ZentaoError('E5002', undefined, details);
            }
            return new ZentaoError('E1002', { url: '' }, details);
        }
        case 'E_API_FAILED':
            return new ZentaoError('E2008', {
                url: '',
                status: '',
                serverResponse: String(params.message ?? d.message ?? ''),
            }, details);
        case 'E_LOGIN_FAILED':
            return new ZentaoError('E1003', undefined, details);
        case 'E_UNSUPPORTED_ZENTAO_VERSION':
            return new ZentaoError('E2010', {
                action: String(d.action ?? ''),
                version: String(d.version ?? ''),
                minVersion: Array.isArray(d.minVersion) ? d.minVersion.join(' / ') : String(d.minVersion ?? ''),
            }, details);
        case 'E_INVALID_ZENTAO_VERSION':
            return new ZentaoError('E2011', { version: String(params.version ?? '') }, details);
        case 'E_INVALID_ZENTAO_CONFIG':
            return new ZentaoError('E2012', undefined, details);
        case 'E_FILE_RESOLVE_FAILED':
            return new ZentaoError('E2013', { path: String(params.path ?? '') }, fileRecoveryDetails(details));
        case 'E_FILE_UPLOAD_FAILED':
            return new ZentaoError('E2014', undefined, fileRecoveryDetails(details));
        case 'E_FILE_SESSION_CHANGED':
            return new ZentaoError('E2015', undefined, fileRecoveryDetails(details));
        case 'E_FILE_SAVE_UNCONFIRMED':
            return new ZentaoError('E2016', undefined, fileRecoveryDetails(details));
        case 'E_MISSING_PARAM':
            return new ZentaoError('E2003', { fields: String(params.param ?? ''), module: '' }, details);
        case 'E_INVALID_PARAM': {
            const field = String(params.param ?? '');
            const value = String(params.value ?? '');
            return new ZentaoError('E2004', { field: field ?? '', value: value ?? '' }, details);
        }
        case 'E_INVALID_MODULE':
            return new ZentaoError('E2001', { module: String(params.module ?? '') }, details);
        case 'E_INVALID_ACTION':
        case 'E_INVALID_REQUEST_NAME':
            return new ZentaoError('E2005', { module: '' }, details);
        case 'E_NO_PROFILE':
        case 'E_NO_GLOBAL_CLIENT':
            return new ZentaoError('E1006', undefined, details);
        case 'E_PROFILE_NOT_FOUND':
            return new ZentaoError('E1007', undefined, details);
        default:
            return new ZentaoError('E2008', { url: '', status: '', serverResponse: sdkMessage(error) }, details);
    }
}

function sdkMessage(error: SdkErrorLike): string {
    const template = SDK_ERRORS[error.code as keyof typeof SDK_ERRORS];
    if (!template) return error.message ?? String(error.code);
    return interpolate(brandText(template), error.params);
}

function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{([^{}]+)\}/g, (placeholder, key) => params && Object.hasOwn(params, key) ? String(params[key]) : placeholder);
}

/** 将 ZentaoError 格式化为用户可读的字符串（Markdown 或 JSON） */
export function formatError(error: ZentaoError, format: string): string {
    if (format === 'json' || format === 'raw') {
        const obj: Record<string, unknown> = {
            ok: false,
            error: {
                code: error.code,
                message: error.message,
            },
        };
        if (error.details) {
            obj.error = { ...(obj.error as Record<string, unknown>), details: error.details };
        }
        return JSON.stringify(obj, null, 4);
    }
    const message = `Error(E${error.code}): ${error.message}`;
    const recovery = fileRecoveryDetails(error.details);
    if (!recovery?.uid && !recovery?.fileIDs?.length) return message;
    const batch = [
        recovery.uid && `uid=${recovery.uid}`,
        recovery.fileIDs?.length && `fileIDs=${recovery.fileIDs.join(',')}`,
    ].filter(Boolean).join('，');
    return `${message}\n附件上传批次（${batch}）。重试前请先核对对象的保存结果和附件归属。`;
}
