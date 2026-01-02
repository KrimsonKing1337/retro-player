import { spawn } from 'node:child_process';

export class Xdotool {
  static run(...args: string[]) {
    return new Promise((resolve, reject) => {
      const p = spawn('xdotool', args);

      let out = '';
      let err = '';

      p.stdout.on('data', (d) => (out += d.toString()));
      p.stderr.on('data', (d) => (err += d.toString()));

      p.on('error', (e) => {
        reject(e);
      });

      p.on('close', (code, signal) => {
        const stdout = out.trim();
        const stderr = err.trim();

        if (code === 0) {
          resolve(stdout);

          return;
        }

        const signalStr = signal ?? 'none';
        const argsStr = args.join(' ');
        const stderrStr = stderr ? `stderr: ${stderr}\n` : '';
        const stdoutStr = stdout ? `stdout: ${stdout}\n` : '';

        const msg =
          `xdotool failed (code=${code}, signal=${signalStr})\n` +
          `args: ${argsStr}\n` +
          `${stderrStr} ${stdoutStr}`;

        reject(new Error(msg));
      });
    });
  }

  static async key(key: string) {
    await this.run('key', key);
  }

  static async activate(win: string | number) {
    await this.run('windowactivate', '--sync', String(win));
  }
}
