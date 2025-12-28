import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type FluidSynthOptions = {
  midiAbsFiles: string[];
  // fluidsynth executable name/path
  fluidsynthBin?: string;
};

export class FluidSynth {
  private proc: ChildProcessWithoutNullStreams | null = null;

  private index = 0;
  private paused = false;
  private busy = false;

  private readonly midiAbsFiles: string[];
  private readonly fluidsynthBin: string;

  constructor(opts: FluidSynthOptions) {
    this.midiAbsFiles = opts.midiAbsFiles;
    this.fluidsynthBin = opts.fluidsynthBin ?? 'fluidsynth';
  }

  private waitExit(p: ChildProcessWithoutNullStreams, timeoutMs = 1000): Promise<void> {
    return new Promise((resolve) => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      p.once('exit', finish);
      p.once('close', finish);

      setTimeout(finish, timeoutMs); // чтобы не зависнуть навсегда
    });
  }

  /** Запускает fluidsynth (интерактивный режим), не начинает воспроизведение. */
  async start(): Promise<void> {
    if (this.proc) return;

    const args: string[] = [
      '-i',
      '--audio-bufsize',
      '2048',
      '-g',
      '1.0',
      this.midiAbsFiles[this.index],
    ];

    this.proc = spawn(this.fluidsynthBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.stdout.on('data', (d) => process.stdout.write(String(d)));
    this.proc.stderr.on('data', (d) => process.stderr.write(String(d)));

    this.proc.on('exit', (code, signal) => {
      console.log(`\nfluidsynth exited: code=${code} signal=${signal}`);
      this.proc = null;
      this.paused = false;
    });

    // fluidsynth нужен небольшой прогрев, чтобы принимал команды стабильно
    await sleep(200);
  }

  /** Корректно останавливает fluidsynth. */
  async stop(): Promise<void> {
    const p = this.proc;
    if (!p) return;

    // попросили красиво
    try {
      p.stdin.write("quit\n");
    } catch {}

    // ждём завершения
    await this.waitExit(p, 800);

    // если всё ещё не умер — добиваем
    if (this.proc === p) {
      try { p.kill("SIGTERM"); } catch {}
      await this.waitExit(p, 400);
    }

    // крайний случай
    if (this.proc === p) {
      try { p.kill("SIGKILL"); } catch {}
      await this.waitExit(p, 200);
    }

    // только теперь считаем, что процесса нет
    if (this.proc === p) this.proc = null;
    this.paused = false;
  }

  /** Начать воспроизведение трека по индексу (с циклическим модулем). */
  async playAt(i: number = 0): Promise<void> {
    if (!this.midiAbsFiles.length) {
      throw new Error('Playlist empty');
    }

    this.index = (i + this.midiAbsFiles.length) % this.midiAbsFiles.length;
    const file = this.midiAbsFiles[this.index];

    console.log(`\n▶ ${this.index + 1}/${this.midiAbsFiles.length}: ${path.basename(file)}`);

    this.paused = false;

    // this.send('player_stop');
    await this.stop();
    await this.start();
    // this.send('player_start');
  }

  async next(): Promise<void> {
    await this.playAt(this.index + 1);
  }

  async prev(): Promise<void> {
    await this.playAt(this.index - 1);
  }

  async restart(): Promise<void> {
    await this.playAt(this.index);
  }

  togglePause(): void {
    if (!this.proc) {
      return;
    }

    if (!this.paused) {
      this.send('player_stop');
      this.paused = true;
      console.log('⏸ paused');
    } else {
      this.send('player_cont');
      this.paused = false;
      console.log('▶ resumed');
    }
  }

  /** Хелпер для отправки команды в интерактивную консоль fluidsynth. */
  private send(cmd: string): void {
    if (!this.proc) return;
    this.proc.stdin.write(cmd + '\n');
  }

  /** Привязывает управление к клавиатуре (N/P/Space/R/Q). */
  bindKeyboardControls(): void {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    console.log(
      '\nControls:\n' +
      '  Space = stop/cont (toggle pause)\n' +
      '  N = next track\n' +
      '  P = prev track\n' +
      '  R = restart current\n' +
      '  Q = quit\n'
    );

    process.stdin.on('keypress', async (_str, key) => {
      if (!key) {
        return;
      }

      if (key.ctrl && key.name === 'c') {
        await this.stop();
        process.exit(0);
      }

      if (this.busy) {
        return;
      }

      this.busy = true;

      try {
        switch (key.name) {
          case 'space':
            this.togglePause();
            break;
          case 'n':
            await this.next();
            break;
          case 'p':
            await this.prev();
            break;
          case 'r':
            await this.restart();
            break;
          case 'q':
            await this.stop();
            process.exit(0);
            break;
          default:
            break;
        }
      } finally {
        this.busy = false;
      }
    });
  }
}

