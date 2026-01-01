import { spawn } from 'node:child_process';

export class Xdotool {
  static run(...args: string[]) {
    return new Promise((resolve, reject) => {
      const p = spawn('xdotool', args);

      let out = '';
      let err = '';

      p.stdout.on('data', (d) => (out += d.toString()));
      p.stderr.on('data', (d) => (err += d.toString()));

      p.on('exit', code => {
        if (code === 0) {
          resolve(out.trim());
        } else {
          reject(new Error(`xdotool exited with ${code}`));
        }
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
