import { brandText } from '../brand.js';
import { Command } from 'commander';
import { ZentaoError } from '../errors.js';

/** Walk actual commands while skipping global and action option values. */
export function completionCandidates(program: Command, words: string[]): string[] {
    let current = program;
    const prefix = words.at(-1) ?? '';
    let valueFor: import('commander').Option | undefined;
    const options = () => {
        const result = [...current.options];
        for (let parent = current.parent; parent; parent = parent.parent) result.push(...parent.options);
        return result;
    };
    for (const word of words.slice(0, -1)) {
        if (valueFor) { valueFor = undefined; continue; }
        if (word.startsWith('-')) {
            const option = options().find(option => option.long === word.split('=')[0] || option.short === word);
            if (option?.required && !word.includes('=')) valueFor = option;
            continue;
        }
        current = current.commands.find(command => command.name() === word) ?? current;
    }
    if (valueFor) return (valueFor.argChoices ?? []).filter(value => value.startsWith(prefix));
    return [...new Set([...current.commands.filter(cmd => cmd.name() !== 'candidates').map(cmd => cmd.name()),
        ...options().flatMap(option => [option.long, option.short].filter(Boolean) as string[])])].filter(value => value.startsWith(prefix));
}

export function generateCompletionScript(shell: string, _program?: Command): string {
    if (shell === 'bash') return brandText`# bash completion for zentao (no bash-completion dependency)
_zentao_completion() {
  COMPREPLY=()
  local candidate
  while IFS= read -r candidate; do COMPREPLY+=("$candidate"); done < <(zentao completion candidates -- "\${COMP_WORDS[@]:1:COMP_CWORD}")
}
complete -F _zentao_completion zentao
`;
    if (shell === 'zsh') return brandText`#compdef zentao
_zentao() {
  local -a candidates
  candidates=("\${(@f)$(zentao completion candidates -- "\${words[@]:1:$((CURRENT-1))}")}")
  compadd -- "\${candidates[@]}"
}
compdef _zentao zentao
`;
    if (shell === 'fish') return brandText`# fish completion for zentao
function __zentao_candidates
  set -l words (commandline -opc)
  zentao completion candidates -- $words[2..-1] (commandline -ct)
end
complete -c zentao -f -a '(__zentao_candidates)'
`;
    throw new ZentaoError('E2009', { option: 'shell', reason: '支持 bash、zsh、fish' });
}

export function registerAutocompleteCommand(program: Command): void {
    const completion = program.command('completion').description('将补全脚本写入 stdout');
    completion.action(() => completion.outputHelp());
    for (const shell of ['bash', 'zsh', 'fish']) completion.command(shell).action(() => { process.stdout.write(generateCompletionScript(shell)); });
    completion.command('candidates', { hidden: true }).argument('[words...]').allowUnknownOption(true)
        .action((words: string[]) => { const values = completionCandidates(program, words); if (values.length) process.stdout.write(values.join('\n') + '\n'); });
}
