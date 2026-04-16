import type { Command } from 'commander';
import { registerLoginCommand } from './login.js';
import { registerLogoutCommand } from './logout.js';
import { registerProfileCommand } from './profile.js';
import { registerConfigCommand } from './config.js';
import { registerWorkspaceCommand } from './workspace.js';
import { registerVersionCommand } from './version.js';
import { registerAutocompleteCommand } from './autocomplete.js';
import { registerAddSkillCommand } from './add-skill.js';
import { registerCrudCommands } from './crud.js';
import { registerModuleCommands } from './register-modules.js';
import { registerMcpCommand } from './mcp.js';

/** 注册内置子命令与各动态模块子命令 */
export function registerAllCommands(program: Command): void {
    registerLoginCommand(program);
    registerLogoutCommand(program);
    registerProfileCommand(program);
    registerConfigCommand(program);
    registerWorkspaceCommand(program);
    registerVersionCommand(program);
    registerAutocompleteCommand(program);
    registerAddSkillCommand(program);
    registerMcpCommand(program);
    registerCrudCommands(program);
    registerModuleCommands(program);
}
