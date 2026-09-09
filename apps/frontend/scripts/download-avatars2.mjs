// Download avatars from Unsplash portrait photos.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/images');
await mkdir(OUT, { recursive: true });

const faces = [
  'photo-1494790108377-be9c29b29330', // 01 woman
  'photo-1507003211169-0a1dd7228f2d', // 02 man
  'photo-1438761681033-6461ffad8d80', // 03 woman
  'photo-1544005313-94ddf0286df2',    // 04 woman
  'photo-1500648767791-00dcc994a43e', // 05 man
  'photo-1534528741775-53994a69daeb', // 06 woman
  'photo-1517841905240-472988babdf9', // 07 woman
  'photo-1529626455594-4ff0802cfb7e', // 08 woman
  'photo-1531123897727-8f129e1688ce', // 09 woman
  'photo-1521119989659-a83eee488004', // 10 woman
  'photo-1531746020798-e6953c6e8e04', // 11 man
  'photo-1544725176-7c40e5a71c5e',    // 12 woman
  'photo-1506794778202-cad84cf45f1d', // 13 man
  'photo-1580489944761-15a19d654956', // 14 woman
  'photo-1599566150163-29194dcaad36', // 15 man
  'photo-1531427186611-ecfd6d936c79', // 16 man
  'photo-1499996860823-5214fcc65f8f', // 17 man
  'photo-1547425260-76bcadfb4f2c',    // 18 woman
];

let ok = 0, fail = 0;
for (let i = 0; i < faces.length; i++) {
  const name = `avatar-${String(i + 1).padStart(2, '0')}.jpg`;
  const dest = resolve(OUT, name);
  if (existsSync(dest)) { ok++; continue; }
  const url = `https://images.unsplash.com/${faces[i]}?w=300&h=300&q=80&auto=format&fit=crop`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error('too small');
    await writeFile(dest, buf);
    ok++; console.log(`ok   ${name}`);
  } catch (e) { fail++; console.log(`FAIL ${name} :: ${e.message}`); }
}
console.log(`\nDone: ${ok} ok, ${fail} failed.`);
