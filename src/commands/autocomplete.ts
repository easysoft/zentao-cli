import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { getModuleNames } from '../modules/index.js';
import { AGENT_NAMES as SKILL_AGENT_NAMES } from './add-skill.js';
import { AGENT_NAMES as MCP_AGENT_NAMES } from './add-mcp.js';

const CONFIG_SUBCOMMANDS = ['get', 'set'];

function createCandidates(program: Command): string {
    return [...new Set(program.commands.flatMap((command) => [command.name(), ...command.aliases()]))]
        .sort()
        .join(' ');
}

function getCommonOptions(program: Command): string[] {
    return program.createHelp().visibleOptions(program)
        .flatMap((option) => [option.short, option.long].filter(Boolean) as string[]);
}

function generateBashScript(program: Command, command = 'zentao'): string {
    const commands = createCandidates(program);
    const commonOptions = getCommonOptions(program);
    return `# bash completion for ${command}
_${command}_completion() {
  local cur prev words cword
  _init_completion -n : || return

  local root_commands="${commands}"
  local config_subcommands="${CONFIG_SUBCOMMANDS.join(' ')}"
  local common_options="${commonOptions.join(' ')}"

  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${root_commands} \${common_options}" -- "\${cur}") )
    return
  fi

  case "\${words[1]}" in
    config)
      COMPREPLY=( $(compgen -W "\${config_subcommands} \${common_options}" -- "\${cur}") )
      ;;
    ls|get|create|update|delete|do)
      if [[ \${cword} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${getModuleNames().join(' ')}" -- "\${cur}") )
      else
        COMPREPLY=( $(compgen -W "\${common_options}" -- "\${cur}") )
      fi
      ;;
    autocomplete)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      ;;
    add-skill)
      if [[ "\${prev}" == "--output" || "\${prev}" == "-o" ]]; then
        COMPREPLY=( $(compgen -d -- "\${cur}") )
      else
        COMPREPLY=( $(compgen -W "${[...SKILL_AGENT_NAMES, 'all', '--output', '-o'].join(' ')}" -- "\${cur}") )
      fi
      ;;
    add-mcp)
      COMPREPLY=( $(compgen -W "${[...MCP_AGENT_NAMES, 'all'].join(' ')}" -- "\${cur}") )
      ;;
    *)
      COMPREPLY=( $(compgen -W "\${common_options}" -- "\${cur}") )
      ;;
  esac
}

complete -F _${command}_completion ${command}
`;
}

function generateZshScript(program: Command, command = 'zentao'): string {
    const commands = createCandidates(program);
    const modules = getModuleNames().join(' ');
    const commonOptions = getCommonOptions(program);
    return `#compdef ${command}

_${command}() {
  local -a root_commands modules common_opts
  root_commands=(${commands})
  modules=(${modules})
  common_opts=(${commonOptions.join(' ')})

  if (( CURRENT == 2 )); then
    _describe 'command' root_commands
    return
  fi

  case "$words[2]" in
    config)
      _values 'config command' ${CONFIG_SUBCOMMANDS.map((s) => `'${s}'`).join(' ')}
      ;;
    ls|get|create|update|delete|do)
      if (( CURRENT == 3 )); then
        _describe 'module' modules
      else
        _describe 'option' common_opts
      fi
      ;;
    autocomplete)
      _values 'shell' 'bash' 'zsh' 'fish'
      ;;
    add-skill)
      _arguments \\
        '(-o --output)'{-o,--output}'[将所有内置技能导出到指定目录]:目录:_files -/' \\
        '1:agent:(${[...SKILL_AGENT_NAMES, 'all'].join(' ')})'
      ;;
    add-mcp)
      _values 'agent' ${[...MCP_AGENT_NAMES, 'all'].map((name) => `'${name}'`).join(' ')}
      ;;
    *)
      _describe 'option' common_opts
      ;;
  esac
}

compdef _${command} ${command}
`;
}

function generateFishScript(program: Command, command = 'zentao'): string {
    const commands = createCandidates(program);
    const modules = getModuleNames().join(' ');
    const commonOptions = getCommonOptions(program).join(' ');
    return `# fish completion for ${command}
set -l __${command}_cmds ${commands}
set -l __${command}_mods ${modules}

complete -c ${command} -f
complete -c ${command} -n "__fish_use_subcommand" -a "$__${command}_cmds"
complete -c ${command} -a "${commonOptions}"

complete -c ${command} -n "__fish_seen_subcommand_from config" -a "${CONFIG_SUBCOMMANDS.join(' ')}"
complete -c ${command} -n "__fish_seen_subcommand_from autocomplete" -a "bash zsh fish"
complete -c ${command} -n "__fish_seen_subcommand_from add-skill" -a "${[...SKILL_AGENT_NAMES, 'all'].join(' ')}"
complete -c ${command} -n "__fish_seen_subcommand_from add-skill" -s o -l output -r -d "将所有内置技能导出到指定目录"
complete -c ${command} -n "__fish_seen_subcommand_from add-mcp" -a "${[...MCP_AGENT_NAMES, 'all'].join(' ')}"
complete -c ${command} -n "__fish_seen_subcommand_from ls get create update delete do; and test (count (commandline -opc)) -eq 2" -a "$__${command}_mods"
`;
}

export function generateCompletionScript(shell: string, program: Command): string {
    switch (shell) {
        case 'bash':
            return generateBashScript(program);
        case 'zsh':
            return generateZshScript(program);
        case 'fish':
            return generateFishScript(program);
        default:
            throw new Error(`不支持的 shell: ${shell}`);
    }
}

function getCompletionFilePath(shell: string): string {
    return join(homedir(), '.config', 'zentao', `.zentao-completion.${shell}`);
}

async function promptShellSelection(): Promise<string> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new Error('未提供 shell 参数，请在交互终端中选择，或显式传入 bash|zsh|fish');
    }

    const shells = ['zsh', 'bash', 'fish'] as const;
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    process.stderr.write('请选择要生成的自动补全脚本:\n');
    shells.forEach((shell, index) => {
        process.stderr.write(`  ${index + 1}) ${shell}\n`);
    });

    try {
        const answer = await rl.question('请输入编号 (1-3): ');
        const idx = Number(answer.trim());
        if (!Number.isInteger(idx) || idx < 1 || idx > shells.length) {
            throw new Error(`无效选择: ${answer || '(empty)'}`);
        }
        return shells[idx - 1];
    } finally {
        rl.close();
    }
}

/** 注册 `zentao autocomplete`：输出 shell 自动补全脚本 */
export function registerAutocompleteCommand(program: Command): void {
    program
        .command('autocomplete')
        .description('生成 shell 自动补全脚本')
        .argument('[shell]', 'shell 类型 (bash|zsh|fish)')
        .action(async (shell?: string) => {
            const selectedShell = shell ?? await promptShellSelection();
            const normalized = selectedShell.toLowerCase();
            if (!['bash', 'zsh', 'fish'].includes(normalized)) {
                throw new Error(`不支持的 shell: ${selectedShell}，仅支持 bash、zsh、fish`);
            }

            const script = generateCompletionScript(normalized, program);
            const completionFile = getCompletionFilePath(normalized);
            const completionDir = join(homedir(), '.config', 'zentao');

            mkdirSync(completionDir, { recursive: true });
            writeFileSync(completionFile, script, 'utf-8');

            console.log(`自动补全脚本已保存到: ${completionFile}`);
            console.log(`请在终端配置中追加: source ${completionFile}`);
        });
}
