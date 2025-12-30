import fg from 'fast-glob';
import readline from 'node:readline';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

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

function play(file: string) {
  if (cvlc) {
    cvlcSend('quit');
    cvlc = null;
  }

  const type = fileType(files[index]);

  if (type === 'other') {
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

        cvlcSend('quit');

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
