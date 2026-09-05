import type { UserConfig } from '../types/index.js';

/** 用户配置默认值，当 Profile 中未设置对应字段时使用 */
export const DEFAULT_CONFIG: Required<UserConfig> = {
    defaultOutputFormat: 'markdown',
    defaultRecPerPage: 20,
    insecure: false,
    timeout: 10000,
    htmlToMarkdown: true,
    batchFailFast: false,
    pagers: {},
    silent: false,
    jsonPretty: false,
};

/** `zentao config set` 允许设置的配置项名称列表 */
export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);
