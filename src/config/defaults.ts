import type { UserConfig } from '../types/index.js';

/** 用户配置默认值，当 Profile 中未设置对应字段时使用 */
export const DEFAULT_CONFIG: Required<UserConfig> = {
    defaultOutputFormat: 'markdown',
    lang: 'zh-CN',
    defaultRecPerPage: 20,
    insecure: false,
    timeout: 10000,
    htmlToMarkdown: true,
    batchFailFast: false,
    autoSetWorkspace: false,
    pagers: {},
    silent: false,
    jsonPretty: false,
};

/** `zentao config set` 允许设置的配置项名称列表 */
export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);

/** 配置文件基名（不含扩展名），与 Configstore 包名等配合使用 */
export const CONFIG_FILE_NAME = 'zentao';
/** 用户配置目录名，位于 `~/.config/<CONFIG_DIR>/` 下 */
export const CONFIG_DIR = 'zentao';
