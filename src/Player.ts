import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';
import 'dotenv/config';

import { Xdotool } from './Xdotool.js';
import { setClipboard } from './setClipboard.js';

const FILES_SRC = process.env.FILES_SRC as string;
const MMF_DEST = process.env.MMF_DEST as string;
const SF_SRC = process.env.SF_SRC as string;

export class Player {
  private readonly audios: string[];
  private readonly soundfonts: string[];

  private audiosIndex: number;
  private soundfontIndex: number;

  private paused = true;
  private cvlc: ChildProcessWithoutNullStreams | null;
  private fluidsynth: ChildProcessWithoutNullStreams | null;

  static getFiles(): string[] {
    return fg.sync(FILES_SRC, {
      onlyFiles: true,
      absolute: true,
    });
  }

  static getSoundfonts(): string[] {
    const soundfonts = fg.sync(SF_SRC, {
      onlyFiles: true,
      absolute: true,
    });

    soundfonts.unshift(''); // default soundfont

    return soundfonts;
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
    await fs.rm(MMF_DEST, { recursive: true, force: true });
    await fs.mkdir(MMF_DEST);
    await fs.cp(file, `${MMF_DEST}/${path.basename(file)}`);
  }

  static async playMmf(file: string) {
    await Player.mmfFileProcessing(file);
    await Xdotool.run('sleep', '0.15');

    const winTerminalId = await Xdotool.run('getactivewindow');

    await Xdotool.run('search', '--sync', '--name', 'MidRadio Player', 'windowactivate');
    await Xdotool.run('sleep', '0.15');

    await Xdotool.key('Shift+F10');
    await Xdotool.run('sleep', '0.15');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.key('Down');
    await Xdotool.run('sleep', '0.15');
    await Xdotool.key('Return');

    await setClipboard(path.basename(file));

    await Xdotool.run('sleep', '0.15');
    await Xdotool.key('Ctrl+V');
    await Xdotool.run('sleep', '0.15');
    await Xdotool.key('Return');

    await Xdotool.run('sleep', '0.15');
    await Xdotool.run('windowactivate', '--sync', winTerminalId as string);
  }

  static async pauseMmf() {
    await Xdotool.run('sleep', '0.15');

    const winPlayerId = await Xdotool.run('search', '--sync', '--name', 'MidRadio Player') as string;
    const winTerminalId = await Xdotool.run('getactivewindow') as string;

    await Xdotool.run('windowactivate', '--sync', winPlayerId);
    await Xdotool.run('sleep', '0.15');

    await Xdotool.run('key', '--window', winPlayerId, 'space'); // lowercase!

    await Xdotool.run('sleep', '0.15');
    await Xdotool.run('windowactivate', '--sync', winTerminalId);
  }

  constructor() {
    this.audios = Player.getFiles();
    this.soundfonts = Player.getSoundfonts();

    this.audiosIndex = 0;
    this.soundfontIndex = 0;

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

    this.cvlc.stderr.on('data', async (d) => {
      const data = String(d);

      process.stderr.write(data);

      if (data.toLowerCase().includes('error')) {
        await this.next();
      }
    });
  }

  fluidsynthSend(cmd: string) {
    if (!this.fluidsynth) {
      return;
    }

    this.fluidsynth.stdin.write(cmd + '\n');
  }

  fluidsynthPlay(file: string, soundfont: string = '') {
    const params = [
      '--audio-bufsize',
      '2048',
      '-g',
      '1.0',
    ];

    if (soundfont) {
      params.push(soundfont);
    }

    params.push(file);

    this.fluidsynth = spawn('fluidsynth', params, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.fluidsynth.stdout.on('data', d => process.stdout.write(String(d)));
    this.fluidsynth.stderr.on('data', d => process.stderr.write(String(d)));
  }

  fluidSynthNextSoundfont() {
    this.fluidsynthSend('quit');
    this.fluidsynth = null;
    this.soundfontIndex = (this.soundfontIndex + 1) % this.soundfonts.length;

    this.fluidsynthPlay(this.audios[this.audiosIndex], this.soundfonts[this.soundfontIndex]);
  }

  async quitMmfPlayer() {
    if (!this.paused) {
      await Player.pauseMmf();
    }
  }

  async togglePlayPause() {
    if (this.paused) {
      console.log('play');
      await this.play(this.audios[this.audiosIndex]);
    } else {
      console.log('pause');
      await this.pause();
    }
  }

  async pause() {
    this.paused = true;

    if (this.fluidsynth) {
      this.fluidsynthSend('player_stop');
    } else if (this.cvlc) {
      this.cvlcSend('pause');
    }

    const type = Player.fileType(this.audios[this.audiosIndex]);

    if (type === 'mmf') {
      await Player.pauseMmf();
    }
  }

  async play(file: string) {
    this.paused = false;

    if (this.fluidsynth) {
      this.fluidsynthSend('quit');
      this.fluidsynth = null;
    }

    if (this.cvlc) {
      this.cvlcSend('quit');
      this.cvlc = null;
    }

    const type = Player.fileType(this.audios[this.audiosIndex]);

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

    const type = Player.fileType(this.audios[this.audiosIndex]);

    if (type === 'mmf') {
      await this.quitMmfPlayer();
    }

    console.log('quit');
    process.exit(0);
  }

  async next() {
    console.log('next ->');

    this.audiosIndex = (this.audiosIndex + 1) % this.audios.length;
    await this.play(this.audios[this.audiosIndex]);
  }

  async prev() {
    console.log('prev <-');

    this.audiosIndex = (this.audiosIndex - 1) % this.audios.length;
    await this.play(this.audios[this.audiosIndex]);
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
          await this.togglePlayPause();

          break;
        case 'n':
          await this.next();

          break;
        case 'p':
          await this.prev();

          break;
        case 'w':
          this.fluidSynthNextSoundfont();

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
    if (!FILES_SRC || !MMF_DEST || !SF_SRC) {
      throw new Error('FILES_SRC || MMF_DEST || SF_SRC env variable(s) not set (check .env)');
    }

    this.bindKeyboardControls();
  }
}
