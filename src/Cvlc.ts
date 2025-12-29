import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';

export type CvlcOptions = {
  absFiles: string[];
};

export class Cvlc {
  private readonly absFiles: string[];

  private proc: ChildProcessWithoutNullStreams | null = null;

  constructor(opts: CvlcOptions) {
    this.absFiles = opts.absFiles;
  }

  send(cmd: string) {
    if (!this.proc) {
      return;
    }

    this.proc.stdin.write(cmd + '\n');
  }

  start() {
    if (this.proc) {
      return;
    }

    this.proc = spawn('cvlc', [
      '--intf', 'rc',
      '--rc-fake-tty',
      ...this.absFiles,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.stdout.on('data', d => process.stdout.write(String(d)));
    this.proc.stderr.on('data', d => process.stderr.write(String(d)));

    this.proc.on('exit', () => {
      this.proc = null;
    });
  }

  // clvc pause = toggle play and pause
  pause() {
    this.send('pause');
  }

  stop() {
    this.send('stop');
  }

  quit() {
    this.send('quit');
  }

  next() {
    this.send('next');
  }

  prev() {
    this.send('prev');
  }

  bindKeyboardControls(): void {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    console.log(
      '\nControls:\n' +
      '  Space = play/pause\n' +
      '  N = next track\n' +
      '  P = prev track\n' +
      '  Q = quit\n'
    );

    process.stdin.on('keypress', async (_str, key) => {
      if (!key) {
        return;
      }

      if (key.ctrl && key.name === 'c') {
        await this.quit();
        process.exit(0);
      }

      switch (key.name) {
        case 'space':
          this.pause();
          break;
        case 'n':
          await this.next();
          break;
        case 'p':
          await this.prev();
          break;
        case 'q':
          await this.quit();
          process.exit(0);
          break;
        default:
          break;
      }
    });
  }
}
