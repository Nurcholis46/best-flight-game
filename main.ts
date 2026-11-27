// Emberwing Ring Run — hand-in program (Node 22, standard library only).
// The game itself is the static site under game/ (game/index.html plus its
// ES modules, no library, no network request): three sorties (Ring Run,
// Slalom Sprint, Cargo Drop) over a dressed island, with a 3D-projected
// aircraft, particle effects, combo scoring and wind. This program copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with buildDossier from the vendored make.fun
// library, exactly as the bounty requires.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Refuse to hand in a broken entry: the game shell and at least one
// screenshot must exist beside this file before anything is copied.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html missing — nothing to hand in');
}
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir) || readdirSync(shotDir).length === 0) {
  throw new Error('screenshots/ is empty — capture the cover shots first');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: only text_max_bytes shapes the dossier bytes; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 entries in game/ or 48 MiB of game files, or
// a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
