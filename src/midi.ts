import fs from 'node:fs/promises';

import fg from 'fast-glob';

import { FluidSynth } from './Fluidsynth.js';
import { dirExists } from './dirExist.js';

const DEST = 'D:/Projects/retro-player/examples_dest/midi';

async function filesProcessing() {
  const midiFiles = fg.sync('*.{mid,midi}', {
    cwd: 'examples/midi',
    onlyFiles: true,
  });

  const midiFilesAbsolute = fg.sync('*.{mid,midi}', {
    cwd: 'examples/midi',
    onlyFiles: true,
    absolute: true,
  });

  let midiFilesAsString = '';

  midiFiles.forEach((midiFileCur) => {
    midiFilesAsString += `"${midiFileCur}",`
  });

  if (await dirExists(DEST)) {
    await fs.rm(DEST, { recursive: true, force: true });
  }

  return midiFilesAbsolute;
}

// xdotool search --onlyvisible --name MidRadio Player windowactivate

async function playMidi() {
  const midiFilesAbsolute = await filesProcessing();

  const fluidsynth = new FluidSynth({
    midiAbsFiles: midiFilesAbsolute,
  });

  await fluidsynth.start();
  fluidsynth.bindKeyboardControls();
}

async function main() {
  await playMidi();
}

main();
