import { spawn } from 'node:child_process';

/** Detect local desktop sessions without requiring a terminal (Agents often have none). */
export function canOpenBrowser(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY || env.container ||
        (env.CI && !/^(false|0)$/i.test(env.CI))) return false;

    if (platform === 'darwin') return true;
    if (platform === 'win32') return env.SESSIONNAME?.toLowerCase() !== 'services';
    return platform === 'linux' && Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

/** Ask the OS to open a URL, with no shell or browser dependency. */
export async function openBrowser(url: string): Promise<boolean> {
    const command = process.platform === 'darwin' ? ['open', url]
        : process.platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
        : process.platform === 'linux' ? ['xdg-open', url] : undefined;
    if (!command) return false;

    return new Promise((resolve) => {
        let child: ReturnType<typeof spawn>;
        // Some launchers remain attached to the browser; a live process is not a launch failure.
        const timer = setTimeout(() => resolve(true), 5_000);
        const finish = (success: boolean) => {
            clearTimeout(timer);
            resolve(success);
        };
        try {
            child = spawn(command[0], command.slice(1), { stdio: 'ignore', windowsHide: true });
            child.once('error', () => finish(false));
            child.once('exit', (code) => finish(code === 0));
            // Some desktop openers stay alive with the browser; never hold up CLI shutdown.
            child.unref();
        } catch {
            finish(false);
        }
    });
}
