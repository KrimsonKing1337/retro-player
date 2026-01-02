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

        const msg =
          `xdotool failed (code=${code}, signal=${signal ?? 'none'})\n` +
          `args: ${args.join(' ')}\n` +
          (stderr ? `stderr: ${stderr}\n` : '') +
          (stdout ? `stdout: ${stdout}\n` : '');

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
