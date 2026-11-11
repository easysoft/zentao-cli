import type { Command } from 'commander';
import { registerHelpCommand } from './help.js';
import { registerAuthStatusCommand } from './auth-status.js';
import { registerLoginCommand } from './login.js';
import { registerTokenCommand } from './token.js';
import { registerLogoutCommand } from './logout.js';
import { registerProfileCommand } from './profile.js';
import { registerConfigCommand } from './config.js';
import { registerVersionCommand } from './version.js';
import { registerAutocompleteCommand } from './autocomplete.js';
import { registerAddSkillCommand } from './add-skill.js';
import { registerAddMcpCommand } from './add-mcp.js';
import { registerModuleCommands } from './register-modules.js';
import { registerMcpCommand } from './mcp.js';
import { registerUpgradeCommand } from './upgrade.js';

/** 注册内置子命令与各动态模块子命令 */
export function registerAllCommands(program: Command): void {
    registerHelpCommand(program);
    registerLoginCommand(program);
    registerLogoutCommand(program);
    registerTokenCommand(program);
    const auth = program.command('auth').description('认证与凭据');
    auth.action(() => auth.outputHelp());
    registerLoginCommand(auth);
    registerLogoutCommand(auth);
    registerAuthStatusCommand(auth);
    registerProfileCommand(program);
    registerConfigCommand(program);
    registerVersionCommand(program);
    registerAutocompleteCommand(program);
    const skill = program.command('skill').description('安装或导出技能');
    skill.action(() => skill.outputHelp());
    registerAddSkillCommand(skill);
    const mcp = registerMcpCommand(program);
    registerAddMcpCommand(mcp);
    registerAddMcpCommand(program, 'add-mcp');
    registerModuleCommands(program);
    const self = program.command('self').description('管理本机 CLI 安装');
    self.action(() => self.outputHelp());
    registerUpgradeCommand(self);
}
