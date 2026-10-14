// Kullanım (site klasöründen):  node araclar/kontrol.js denemeler/deneme-02.js
// Yeni bir deneme dosyasını yayından önce denetler. Hata varsa çıkış kodu 1 olur.
const fs = require("fs");
const path = require("path");

const dosya = process.argv[2];
if (!dosya) { console.error("Kullanım: node araclar/kontrol.js denemeler/deneme-XX.js"); process.exit(1); }

const oku = f => {
  const kod = fs.readFileSync(f, "utf8");
  const window = {};
  new Function("window", kod)(window);
  return window;
};

const hatalar = [], uyarilar = [];
const D = oku(dosya).DENEME;
if (!D || !Array.isArray(D.Q)) { console.error("window.DENEME.Q bulunamadı."); process.exit(1); }

// 1) Üst bilgiler
for (const k of ["no", "baslik", "tarih", "aciklama"]) if (!D[k]) hatalar.push(`Üst bilgi eksik: ${k}`);
if (D.tarih && !/^\d{4}-\d{2}-\d{2}$/.test(D.tarih)) hatalar.push("tarih YYYY-AA-GG biçiminde olmalı");

// 2) Soru sayısı ve alanlar
if (D.Q.length !== 120) hatalar.push(`Soru sayısı 120 olmalı, ${D.Q.length} bulundu`);
const TIPLER = ["bilgi", "olumsuz", "vaka", "oncullu", "eslestirme", "hesap"];
D.Q.forEach((q, i) => {
  const n = i < 40 ? `Temel ${i + 1}` : `Klinik ${i - 39}`;
  if (!TIPLER.includes(q.t)) hatalar.push(`${n}: geçersiz tip "${q.t}"`);
  if (!q.q || q.q.length < 20) hatalar.push(`${n}: soru kökü eksik/kısa`);
  if (!Array.isArray(q.o) || q.o.length !== 5) hatalar.push(`${n}: 5 şık olmalı`);
  else if (new Set(q.o).size !== 5) hatalar.push(`${n}: tekrar eden şık var`);
  if (!"ABCDE".includes(q.a) || q.a.length !== 1) hatalar.push(`${n}: cevap A-E olmalı`);
  if (!q.e || q.e.length < 60) hatalar.push(`${n}: açıklama eksik/kısa`);
  if (q.t === "oncullu" && !(Array.isArray(q.r) && q.r.length >= 3)) hatalar.push(`${n}: öncüllü soruda en az 3 öncül (r) olmalı`);
});

// 3) Cevap anahtarı dengesi (Temel 8'er, Klinik 16'şar hedef)
const say = (a, b) => { const c = { A: 0, B: 0, C: 0, D: 0, E: 0 }; D.Q.slice(a, b).forEach(q => c[q.a]++); return c; };
const kT = say(0, 40), kK = say(40, 120);
for (const [ad, c, hedef] of [["Temel", kT, 8], ["Klinik", kK, 16]])
  for (const l in c) if (Math.abs(c[l] - hedef) > 1) uyarilar.push(`${ad} cevap dağılımı dengesiz: ${l}=${c[l]} (hedef ${hedef})`);

// 4) Soru tipi oranları (2026 sınavına yakınlık)
const tip = (a, b) => { const c = {}; D.Q.slice(a, b).forEach(q => c[q.t] = (c[q.t] || 0) + 1); return c; };
const tT = tip(0, 40), tK = tip(40, 120);
if ((tT.olumsuz || 0) < 4) uyarilar.push(`Temel'de olumsuz kök az (${tT.olumsuz || 0}); 2026'da 5-6 idi`);
if ((tK.olumsuz || 0) < 12) uyarilar.push(`Klinik'te olumsuz kök az (${tK.olumsuz || 0}); hedef 12+`);
if ((tK.vaka || 0) < 15) uyarilar.push(`Klinik'te vaka sorusu az (${tK.vaka || 0}); 2026'da 22 idi`);
if ((tK.oncullu || 0) < 5) uyarilar.push(`Klinik'te öncüllü soru az (${tK.oncullu || 0}); 2026'da 12 idi`);

// 5) Önceki denemelerle tekrar kontrolü (soru kökünün ilk 80 karakteri)
const norm = s => s.replace(/<[^>]+>/g, "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim().slice(0, 80);
const klasor = path.dirname(dosya);
for (const f of fs.readdirSync(klasor).filter(f => /^deneme-\d+\.js$/.test(f) && path.join(klasor, f) !== path.normalize(dosya))) {
  const eski = oku(path.join(klasor, f)).DENEME;
  if (!eski) continue;
  if (eski.no === D.no) hatalar.push(`Deneme no ${D.no} zaten ${f} dosyasında kullanılmış`);
  const set = new Set(eski.Q.map(q => norm(q.q)));
  D.Q.forEach((q, i) => { if (set.has(norm(q.q))) uyarilar.push(`${i < 40 ? "Temel " + (i + 1) : "Klinik " + (i - 39)}: ${f} ile aynı soru kökü`); });
}

// 6) Listeye eklenmiş mi?
try {
  const liste = oku(path.join(klasor, "liste.js")).DENEMELER || [];
  if (!liste.some(d => d.dosya === path.basename(dosya))) hatalar.push(`liste.js içinde ${path.basename(dosya)} kaydı yok`);
} catch (e) { hatalar.push("liste.js okunamadı: " + e.message); }

// Rapor
console.log(`\n${D.baslik} (${path.basename(dosya)})`);
console.log(`Cevap dağılımı  Temel ${JSON.stringify(kT)}  Klinik ${JSON.stringify(kK)}`);
console.log(`Soru tipleri    Temel ${JSON.stringify(tT)}`);
console.log(`                Klinik ${JSON.stringify(tK)}`);
uyarilar.forEach(u => console.log("UYARI  " + u));
hatalar.forEach(h => console.log("HATA   " + h));
console.log(hatalar.length ? `\n${hatalar.length} hata var, yayınlamayın.` : `\nHata yok${uyarilar.length ? `, ${uyarilar.length} uyarı` : ""}. Yayına hazır.`);
process.exit(hatalar.length ? 1 : 0);
