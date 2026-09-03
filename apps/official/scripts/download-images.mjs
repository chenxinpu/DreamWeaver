// Download a curated set of fashion images from Unsplash into public/images.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/images');
await mkdir(OUT, { recursive: true });

// id -> filename (keyword hints)
const IMAGES = {
  // —— 连衣裙 / dresses ——
  'photo-1515372039744-b8f02a3ae446': 'dress-01.jpg',
  'photo-1496747611176-843222e1e57c': 'dress-02.jpg',
  'photo-1539008835657-9e8e9680c956': 'dress-03.jpg',
  'photo-1551488831-00ddcb6c6bd3': 'dress-04.jpg',
  'photo-1595777457583-95e059d581b8': 'dress-05.jpg',
  'photo-1566174053879-31528523f8ae': 'dress-06.jpg',
  'photo-1591369822096-ffd140ec948f': 'dress-07.jpg',
  'photo-1612336307429-8a898d10e223': 'dress-08.jpg',
  'photo-1506629082955-511b1aa562c8': 'dress-09.jpg',
  'photo-1583496661160-fb5886a0aaaa': 'dress-10.jpg',
  'photo-1490481651871-ab68de25d43d': 'dress-11.jpg',
  'photo-1515890435782-59a5bb6ec191': 'dress-12.jpg',
  'photo-1595777457583-95e059d581b8': 'dress-13.jpg',
  'photo-1594633312681-425c7b97ccd1': 'dress-14.jpg',
  'photo-1610030469983-98e550d6193c': 'dress-15.jpg',
  // —— 衬衫 / 上衣 / blouse ——
  'photo-1550639525-c97d455acf70': 'blouse-01.jpg',
  'photo-1594633312681-425c7b97ccd1': 'blouse-02.jpg',
  'photo-1608234807905-4466023792f7': 'coat-01.jpg',
  'photo-1602293589930-45aad59ba3ab': 'top-01.jpg',
  'photo-1578587018452-892bacefd3f2': 'skirt-01.jpg',
  'photo-1583743814966-8936f5b7be1a': 'skirt-02.jpg',
  'photo-1620012253295-c15cc3e65df4': 'skirt-03.jpg',
  'photo-1542060748-10c28b62716f': 'pants-01.jpg',
  'photo-1541099649105-f69ad21f3246': 'pants-02.jpg',
  'photo-1551028719-00167b16eac5': 'jacket-01.jpg',
  'photo-1558769132-cb1aea458c5e': 'jacket-02.jpg',
  'photo-1521572163474-6864f9cf17ab': 'tshirt-01.jpg',
  'photo-1581044777550-4cfa60707c03': 'tshirt-02.jpg',
  'photo-1523381210434-271e8be1f52b': 'tshirt-03.jpg',
  'photo-1605000797499-95a51c5269ae': 'knit-01.jpg',
  'photo-1620799140408-edc6dcb6d633': 'knit-02.jpg',
  'photo-1572804013309-59a88b7e92f1': 'suit-01.jpg',
  'photo-1509319117193-57bab727e09d': 'suit-02.jpg',
  // —— 穿搭 / 街拍 / lifestyle ——
  'photo-1469334031218-e382a71b716b': 'style-01.jpg',
  'photo-1483985988355-763728e1935b': 'style-02.jpg',
  'photo-1524504388940-b1c1722653e1': 'style-03.jpg',
  'photo-1544441893-675973e31985': 'style-04.jpg',
  'photo-1509631179647-0177331693ae': 'style-05.jpg',
  'photo-1529139574466-a303027c1d8b': 'style-06.jpg',
  'photo-1485968579580-b6d095142e6e': 'style-07.jpg',
  'photo-1434389677669-e08b4cac3105': 'style-08.jpg',
  'photo-1441984904996-e0b6ba687e04': 'style-09.jpg',
  'photo-1441986300917-64674bd600d8': 'style-10.jpg',
  'photo-1489987707025-afc232f7ea0f': 'style-11.jpg',
  'photo-1556905055-8f358a7a47b2': 'style-12.jpg',
  'photo-1560243563-062bfc001d68': 'style-13.jpg',
  'photo-1479064555552-3ef4979f8908': 'style-14.jpg',
  'photo-1502716119720-b23a93e5fe1b': 'style-15.jpg',
  'photo-1509316975850-ff9cd1688ebd': 'style-16.jpg',
  'photo-1521119989659-a83eee488004': 'style-17.jpg',
  // —— 面料 / 缝纫 / 工艺 ——
  'photo-1620121692029-d088224ddc74': 'fabric-01.jpg',
  'photo-1602810318383-e386cc2a3ccf': 'fabric-02.jpg',
  'photo-1584589167171-541ce45f1eea': 'craft-01.jpg',
  'photo-1598550476439-6847785fcea6': 'fabric-03.jpg',
  'photo-1529936484954-8b2195b33be3': 'fabric-04.jpg',
  'photo-1571945153237-4929e783af4a': 'craft-02.jpg',
  // —— 家居 / 背景 ——
  'photo-1554995207-c18c203602cb': 'bg-01.jpg',
  'photo-1522708323590-d24dbb6b0267': 'bg-02.jpg',
  'photo-1493663284031-b7e3aefcae8e': 'bg-03.jpg',
};

const BASE = 'https://images.unsplash.com';
let ok = 0, fail = 0;
for (const [id, name] of Object.entries(IMAGES)) {
  const dest = resolve(OUT, name);
  if (existsSync(dest)) { ok++; continue; }
  const url = `${BASE}/${id}?w=900&q=80&auto=format&fit=crop`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error('too small');
    await writeFile(dest, buf);
    ok++;
    console.log(`ok   ${name} (${(buf.length / 1024).toFixed(0)}KB)`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name} :: ${e.message}`);
  }
}
console.log(`\nDone: ${ok} ok, ${fail} failed.`);
