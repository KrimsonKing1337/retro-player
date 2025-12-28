import { spawn } from 'node:child_process';

export class Xdotool {
  static run(...args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const p = spawn('xdotool', args, { stdio: 'ignore' });

      p.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`xdotool exited with ${code}`));
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
