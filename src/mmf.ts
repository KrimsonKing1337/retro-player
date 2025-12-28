import fs from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import { Xdotool } from './Xdotool.js';
import { setClipboard } from './setClipboard.js';
import { dirExists } from './dirExist.js';

const DEST = 'D:/Projects/retro-player/examples_dest/mmf';

async function filesProcessing() {
  const mmfFiles = fg.sync('*.mmf', {
    cwd: 'examples/mmf',
    onlyFiles: true,
  });

  const mmfFilesAbsolute = fg.sync('*.mmf', {
    cwd: 'examples/mmf',
    onlyFiles: true,
    absolute: true,
  });

  let mmfFilesAsString = '';

  mmfFiles.forEach((mmfFileCur) => {
    mmfFilesAsString += `"${mmfFileCur}",`
  });

  if (await dirExists(DEST)) {
    await fs.rm(DEST, { recursive: true, force: true });
  }

  for (const mmfFileCur of mmfFilesAbsolute) {
    await fs.cp(mmfFileCur, `${DEST}/${path.basename(mmfFileCur)}`);
  }

  console.log(mmfFilesAbsolute);

  return mmfFilesAsString;
}

// xdotool search --onlyvisible --name MidRadio Player windowactivate

async function playMmf(clipboardString: string) {
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

  await setClipboard(clipboardString);

  await Xdotool.run('sleep', '0.5');
  await Xdotool.key('Ctrl+V');
  await Xdotool.run('sleep', '0.5');
  await Xdotool.key('Return');
  await Xdotool.run('sleep', '0.5');
  await Xdotool.key('Space');
}

async function main() {
  const clipboardString = await filesProcessing();
  await playMmf(clipboardString);
}

main();
