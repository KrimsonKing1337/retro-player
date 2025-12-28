import { spawn } from 'node:child_process';

export function setClipboard(text: string) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('xclip', ['-selection', 'clipboard'], {
      stdio: ['pipe', 'ignore', 'ignore'],
    });

    p.stdin.write(text);
    p.stdin.end();

    p.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error('xclip failed'));
    });
  });
}
