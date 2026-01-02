import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';
import 'dotenv/config';

import { Xdotool } from './Xdotool.js';
import { dirExists } from './dirExist.js';
import { setClipboard } from './setClipboard.js';

const FILES_SRC = process.env.FILES_SRC as string;
const MMF_DEST = process.env.MMF_DEST as string;

export class Player {
  private readonly files: string[];
  private index: number;
  private paused = false;
  private cvlc: ChildProcessWithoutNullStreams | null;
  private fluidsynth: ChildProcessWithoutNullStreams | null;

  static getFiles(): string[] {
    return fg.sync(FILES_SRC, {
      onlyFiles: true,
      absolute: true,
    });
  }

  static fileType(file: string) {
    const ext = file.split('.').pop();

    if (ext === 'mid' || ext === 'midi') {
      return 'midi';
    } else if (ext === 'mmf') {
      return 'mmf';
    }

    return 'other';
  }

  static async mmfFileProcessing(file: string) {
    if (await dirExists(MMF_DEST)) {
      await fs.rm(MMF_DEST, { recursive: true, force: true });
    }

    await fs.cp(file, `${MMF_DEST}/${path.basename(file)}`);
  }

  static async playMmf(file: string) {
    await Player.mmfFileProcessing(file);

    const winTerminalId = await Xdotool.run('getactivewindow');

    await Xdotool.run('search', '--name', 'MidRadio Player', '--sync');
    await Xdotool.run('search', '--name', 'MidRadio Player', 'windowactivate', '--sync');

    await Xdotool.key('Shift+F10');
    await Xdotool.run('sleep', '0.15');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.run('sleep', '0.1');
    await Xdotool.key('Return');

    await setClipboard(path.basename(file));

    await Xdotool.run('sleep', '0.5');
    await Xdotool.key('Ctrl+V');
    await Xdotool.run('sleep', '0.5');
    await Xdotool.key('Return');
    await Xdotool.run('sleep', '0.5');
    await Xdotool.key('Space');

    await Xdotool.run('sleep', '0.5');
    await Xdotool.run('windowactivate', '--sync', winTerminalId as string);
  }

  static async pauseMmf() {
    await Xdotool.run('search', '--name', 'MidRadio Player', 'windowactivate', '--sync');
    await Xdotool.run('sleep', '0.5');
    await Xdotool.key('Space');
  }

  constructor() {
    this.files = Player.getFiles();
    this.index = 0;
    this.cvlc = null;
    this.fluidsynth = null;
  }

  cvlcSend(cmd: string) {
    if (!this.cvlc) {
      return;
    }

    this.cvlc.stdin.write(cmd + '\n');
  }

  cvlcPlay(file: string) {
    this.cvlc = spawn('cvlc', [
      '--intf',
      'rc',
      '--rc-fake-tty',
      file,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.cvlc.stdout.on('data', d => process.stdout.write(String(d)));
    this.cvlc.stderr.on('data', d => process.stderr.write(String(d)));
  }

  fluidsynthSend(cmd: string) {
    if (!this.fluidsynth) {
      return;
    }

    this.fluidsynth.stdin.write(cmd + '\n');
  }

  fluidsynthPlay(file: string) {
    this.fluidsynth = spawn('fluidsynth', [
      '--audio-bufsize',
      '2048',
      '-g',
      '1.0',
      file,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.fluidsynth.stdout.on('data', d => process.stdout.write(String(d)));
    this.fluidsynth.stderr.on('data', d => process.stderr.write(String(d)));
  }

  async togglePlayPause() {
    if (this.paused) {
      await this.play(this.files[this.index]);
      this.paused = false;
    } else {
      await this.pause();
      this.paused = true;
    }
  }

  async pause() {
    if (this.fluidsynth) {
      this.fluidsynthSend('player_stop');
    } else if (this.cvlc) {
      this.cvlcSend('pause');
    }

    const type = Player.fileType(this.files[this.index]);

    if (type === 'mmf') {
      await Player.pauseMmf();
    }
  }

  async play(file: string) {
    if (this.fluidsynth) {
      this.fluidsynthSend('quit');
      this.fluidsynth = null;
    }

    if (this.cvlc) {
      this.cvlcSend('quit');
      this.cvlc = null;
    }

    const type = Player.fileType(this.files[this.index]);

    if (type === 'midi') {
      this.fluidsynthPlay(file);
    } else if (type === 'mmf') {
      await Player.playMmf(file);
    } else if (type === 'other') {
      this.cvlcPlay(file);
    }
  }

  async quit() {
    if (this.fluidsynth) {
      this.fluidsynthSend('quit');
      this.fluidsynth = null;
    }

    if (this.cvlc) {
      this.cvlcSend('quit');
      this.cvlc = null;
    }

    const type = Player.fileType(this.files[this.index]);

    if (type === 'mmf') {
      await Player.pauseMmf();
    }

    console.log('quit');
    process.exit(0);
  }

  bindKeyboardControls() {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    console.log('waiting for command...');

    process.stdin.on('keypress', async (_str, key) => {
      if (!key) {
        return;
      }

      if (key.ctrl && key.name === 'c') {
        await this.quit();
      }

      switch (key.name) {
        case 'space':
          console.log('play/pause');

          await this.togglePlayPause();

          break;
        case 'n':
          console.log('next ->');

          this.index++;
          await this.play(this.files[this.index]);

          break;
        case 'p':
          console.log('prev <-');

          this.index--;
          await this.play(this.files[this.index]);

          break;
        case 'q':
          await this.quit();
          break;
        default:
          break;
      }
    });
  }

  init() {
    this.bindKeyboardControls();
  }
}
