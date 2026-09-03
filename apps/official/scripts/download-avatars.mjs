// Download avatars (pravatar) and a few missing images.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/images');
await mkdir(OUT, { recursive: true });

let ok = 0, fail = 0;
async function grab(url, name) {
  const dest = resolve(OUT, name);
  if (existsSync(dest)) { ok++; return; }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error('too small');
    await writeFile(dest, buf);
    ok++;
    console.log(`ok   ${name}`);
  } catch (e) { fail++; console.log(`FAIL ${name} :: ${e.message}`); }
}

// avatars
for (let i = 1; i <= 18; i++) {
  await grab(`https://i.pravatar.cc/300?img=${i}`, `avatar-${String(i).padStart(2, '0')}.jpg`);
}
// extra garments
const extra = {
  'photo-1550614000-4895a10e1bfd': 'coat-02.jpg',   // coat
  'photo-1548126032-079a0fb0099d': 'coat-03.jpg',   // coat
  'photo-1578932750294-f5075e85f44a': 'skirt-04.jpg', // skirt
  'photo-1583494939058-8c56ec8d2ba4': 'dress-16.jpg', // dress
  'photo-1623609163859-ca93c959b5b8': 'dress-17.jpg', // dress
  'photo-1610030469983-98e550d6193c': 'dress-18.jpg', // dress
  'photo-1503342217505-b0a15ec3261c': 'style-18.jpg', // fashion
  'photo-1512436991641-6745cdb1723f': 'style-19.jpg', // fashion
  'photo-1529139574466-a303027c1d8b': 'style-20.jpg', // fashion
  'photo-1445205170230-053b83016050': 'style-21.jpg', // fashion
  'photo-1487222477894-8943e31ef7b2': 'style-22.jpg', // fashion
  'photo-1583847268964-b28dc8f51f92': 'style-23.jpg', // fashion
  'photo-1509316975850-ff9cd1688ebd': 'style-24.jpg', // fashion
  'photo-1567401893414-76b7b1e5a7a5': 'bg-04.jpg',   // studio bg
  'photo-1495474472287-4d71bcdd2085': 'bg-05.jpg',   // cafe bg
};
for (const [id, name] of Object.entries(extra)) {
  await grab(`https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`, name);
}
console.log(`\nDone: ${ok} ok, ${fail} failed.`);
