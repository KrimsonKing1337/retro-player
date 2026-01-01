import fg from 'fast-glob';
import readline from 'node:readline';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirExists } from './dirExist.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Xdotool } from './Xdotool.js';
import { setClipboard } from './setClipboard.js';

const MMF_DEST = 'D:/Projects/retro-player/examples_dest/mmf';

const files = fg.sync('D:/Projects/retro-player/examples/**/*.*', {
  onlyFiles: true,
  absolute: true,
});

function fileType(file: string) {
  const ext = file.split('.').pop();

  if (ext === 'mid' || ext === 'midi') {
    return 'midi';
  } else if (ext === 'mmf') {
    return 'mmf';
  }

  return 'other';
}

let index = 0;

let cvlc: ChildProcessWithoutNullStreams | null = null;
let fluidsynth: ChildProcessWithoutNullStreams | null = null;

function cvlcSend(cmd: string) {
  if (!cvlc) {
    return;
  }

  cvlc.stdin.write(cmd + '\n');
}

function cvlcPlay(file: string) {
  cvlc = spawn('cvlc', [
    '--intf', 'rc',
    '--rc-fake-tty',
    file,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  cvlc.stdout.on('data', d => process.stdout.write(String(d)));
  cvlc.stderr.on('data', d => process.stderr.write(String(d)));
}

function fluidsynthSend(cmd: string) {
  if (!fluidsynth) {
    return;
  }

  fluidsynth.stdin.write(cmd + '\n');
}

function fluidsynthPlay(file: string) {
  fluidsynth = spawn('fluidsynth', [
    '-i',
    '--audio-bufsize',
    '2048',
    '-g',
    '1.0',
    file,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  fluidsynth.stdout.on('data', d => process.stdout.write(String(d)));
  fluidsynth.stderr.on('data', d => process.stderr.write(String(d)));
}

async function mmfFileProcessing(file: string) {
  if (await dirExists(MMF_DEST)) {
    await fs.rm(MMF_DEST, { recursive: true, force: true });
  }

  await fs.cp(file, `${MMF_DEST}/${path.basename(file)}`);
}

async function playMmf(file: string) {
  await mmfFileProcessing(file);

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
}

async function play(file: string) {
  if (fluidsynth) {
    fluidsynthSend('quit');
    fluidsynth = null;
  } else if (cvlc) {
    cvlcSend('quit');
    cvlc = null;
  }

  const type = fileType(files[index]);

  if (type === 'midi') {
    fluidsynthPlay(file);
  } else if (type === 'mmf') {
    await playMmf(file);
  } else if (type === 'other') {
    cvlcPlay(file);
  }
}

function bindKeyboardControls(): void {
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  console.log('waiting command');

  process.stdin.on('keypress', async (_str, key) => {
    if (!key) {
      return;
    }

    if (key.ctrl && key.name === 'c') {
      console.log('quit');
      process.exit(0);
    }

    switch (key.name) {
      case 'space':
        console.log('play/pause');
        play(files[index]);

        break;
      case 'n':
        index++;
        play(files[index]);

        break;
      case 'p':
        index--;
        play(files[index]);

        break;
      case 'q':
        console.log('quit');
        process.exit(0);
        break;
      default:
        break;
    }
  });
}

function main() {
  bindKeyboardControls();
}

main();
