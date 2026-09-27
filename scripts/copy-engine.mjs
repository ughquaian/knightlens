import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'node_modules/stockfish/bin');
const targetDir = resolve(root, 'public/engine');

await mkdir(targetDir, { recursive: true });

for (const file of ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']) {
  await copyFile(resolve(sourceDir, file), resolve(targetDir, file));
}

console.log('Stockfish browser engine copied to public/engine.');
