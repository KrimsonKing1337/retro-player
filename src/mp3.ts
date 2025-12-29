import fs from 'node:fs/promises';

import fg from 'fast-glob';

import { Cvlc } from './Cvlc.js';
import { dirExists } from './dirExist.js';

const DEST = 'D:/Projects/retro-player/examples_dest/mp3';

async function filesProcessing() {
  const mp3FilesAbsolute = fg.sync('*.{mp3}', {
    cwd: 'examples/midi',
    onlyFiles: true,
    absolute: true,
  });

  if (await dirExists(DEST)) {
    await fs.rm(DEST, { recursive: true, force: true });
  }

  return mp3FilesAbsolute;
}

async function playMp3() {
  const files = await filesProcessing();

  const cvlc = new Cvlc({
    absFiles: files,
  });

  cvlc.start();
  cvlc.bindKeyboardControls();
}

async function main() {
  await playMp3();
}

main();
