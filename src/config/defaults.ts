import type { UserConfig } from '../types/index.js';

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
};

export const VALID_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);

export const CONFIG_FILE_NAME = 'zentao';
export const CONFIG_DIR = 'zentao';
