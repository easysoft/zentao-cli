import { Command } from 'commander';
import { createInterface } from 'node:readline';
import { getModuleNames } from '../modules/registry.js';

const ROOT_COMMANDS = [
    'login', 'logout', 'profile', 'config', 'workspace', 'version',
    'ls', 'get', 'create', 'update', 'delete', 'do', 'autocomplete',
];

const CONFIG_SUBCOMMANDS = ['get', 'set'];
const WORKSPACE_SUBCOMMANDS = ['ls', 'set'];
const COMMON_OPTIONS = ['--format', '--silent', '--insecure', '--timeout', '-h', '--help'];

function createCandidates(): string {
    const modules = getModuleNames();
    return [...new Set([...ROOT_COMMANDS, ...modules])].sort().join(' ');
}

function generateBashScript(command = 'zentao'): string {
    const commands = createCandidates();
    return `# bash completion for ${command}
_${command}_completion() {
  local cur prev words cword
  _init_completion -n : || return

  local root_commands="${commands}"
  local config_subcommands="${CONFIG_SUBCOMMANDS.join(' ')}"
  local workspace_subcommands="${WORKSPACE_SUBCOMMANDS.join(' ')}"
  local common_options="${COMMON_OPTIONS.join(' ')}"

  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${root_commands} \${common_options}" -- "\${cur}") )
    return
  fi

  case "\${words[1]}" in
    config)
      COMPREPLY=( $(compgen -W "\${config_subcommands} \${common_options}" -- "\${cur}") )
      ;;
    workspace)
      COMPREPLY=( $(compgen -W "\${workspace_subcommands} \${common_options}" -- "\${cur}") )
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
    *)
      COMPREPLY=( $(compgen -W "\${common_options}" -- "\${cur}") )
      ;;
  esac
}

complete -F _${command}_completion ${command}
`;
}

function generateZshScript(command = 'zentao'): string {
    const commands = createCandidates();
    const modules = getModuleNames().join(' ');
    return `#compdef ${command}

_${command}() {
  local -a root_commands modules common_opts
  root_commands=(${commands})
  modules=(${modules})
  common_opts=(${COMMON_OPTIONS.join(' ')})

  if (( CURRENT == 2 )); then
    _describe 'command' root_commands
    return
  fi

  case "$words[2]" in
    config)
      _values 'config command' ${CONFIG_SUBCOMMANDS.map((s) => `'${s}'`).join(' ')}
      ;;
    workspace)
      _values 'workspace command' ${WORKSPACE_SUBCOMMANDS.map((s) => `'${s}'`).join(' ')}
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
    *)
      _describe 'option' common_opts
      ;;
  esac
}

compdef _${command} ${command}
`;
}

function generateFishScript(command = 'zentao'): string {
    const commands = createCandidates();
    const modules = getModuleNames().join(' ');
    return `# fish completion for ${command}
set -l __${command}_cmds ${commands}
set -l __${command}_mods ${modules}

complete -c ${command} -f
complete -c ${command} -n "__fish_use_subcommand" -a "$__${command}_cmds"

complete -c ${command} -n "__fish_seen_subcommand_from config" -a "${CONFIG_SUBCOMMANDS.join(' ')}"
complete -c ${command} -n "__fish_seen_subcommand_from workspace" -a "${WORKSPACE_SUBCOMMANDS.join(' ')}"
complete -c ${command} -n "__fish_seen_subcommand_from autocomplete" -a "bash zsh fish"
complete -c ${command} -n "__fish_seen_subcommand_from ls get create update delete do; and test (count (commandline -opc)) -eq 2" -a "$__${command}_mods"
`;
}

function generateScript(shell: string): string {
    switch (shell) {
        case 'bash':
            return generateBashScript();
        case 'zsh':
            return generateZshScript();
        case 'fish':
            return generateFishScript();
        default:
            throw new Error(`不支持的 shell: ${shell}`);
    }
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

    return new Promise((resolve, reject) => {
        rl.question('请输入编号 (1-3): ', (answer) => {
            rl.close();
            const idx = Number(answer.trim());
            if (!Number.isInteger(idx) || idx < 1 || idx > shells.length) {
                reject(new Error(`无效选择: ${answer || '(empty)'}`));
                return;
            }
            resolve(shells[idx - 1]);
        });
    });
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
                console.error(`不支持的 shell: ${selectedShell}，仅支持 bash、zsh、fish`);
                process.exit(1);
            }

            console.log(generateScript(normalized));
        });
}
