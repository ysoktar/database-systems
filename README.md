# Veritabanı Sistemleri: arasınav çalışma sitesi

BIL372/BIL071 Veritabanı Sistemleri (TOBB ETÜ, 2026–2027 Güz) için etkileşimli bir çalışma sitesi. Site, R. Elmasri & S. B. Navathe'nin
*Fundamentals of Database Systems* (7. baskı) kitabının arasınav kapsamındaki 1–7. bölümlerini ve ders notebook'unu
(`notebook/Ch6_7_SQL_Exercises.ipynb`, *Exercises — Chapters 6 and 7*) izler.

- **Bölüm sayfaları** (Ch 1–7): kavramlar, mimari, ER, EER, ilişkisel model ve kısıtlar, temel SQL, NULL ve iç içe sorgular,
  join/gruplama/WITH, assertion/trigger/view/ALTER. Kitabın COMPANY sorguları (Q0, Q1, …) çalıştırılabilir; ER/EER diyagramları
  kitaptaki gösterimle çizilir. Her sayfanın sonunda sınama soruları var.
- **Notebook alıştırmaları**: notebook'taki 10 SQL alıştırması, notebook'takiyle aynı kontrolcüyle (aynı hash'ler; Python
  kontrolcüsü `site/js/lib/sqlcore.js`'e taşındı). İpuçları, doğrulanmış çözümler ve alternatifler.
- **Arasınav rehberi**: bölüm bölüm bilinmesi gerekenler, çözümlü ER/kısıt/anahtar problemleri, otomatik kontrol edilen 8 SQL
  problemi, sık yapılan hatalar ve bütün sayfaların sorularından oluşan bir deneme seti.
- **Araçlar**: SQL laboratuvarı (serbest konsol ve canlı şema tarayıcı), özet kâğıdı ve sözlük, Ch 8 önizlemesi.

Her SQL kutusu, tarayıcıda çalışan gerçek bir PostgreSQL'e bağlıdır: [PGlite](https://pglite.dev/) (PostgreSQL'in WebAssembly
derlemesi). Sunucu yoktur; site statiktir ve hiçbir veri tarayıcıdan çıkmaz. COMPANY şeması ve verisi (Figure 6.1/6.2 ve
Figure 5.6) notebook'un yardımcı hücresinden birebir alındı.

## Geliştirme

Node 20 veya üstü gerekir.

```sh
npm ci          # PGlite'ı kurar (build sırasında vendor/ altına kopyalanır)
npm run dev     # site/ klasörünü http://localhost:8000 adresinde sunar
npm test        # alıştırma çözümleri PostgreSQL'de, site yapısı, SQL yardımcıları
npm run build   # yayınlanacak siteyi dist/ klasörüne yazar
```

Testler her model çözümü (notebook'un 10 alıştırması ve alternatifleri, rehberin 8 problemi) PGlite üzerinde çalıştırır ve
notebook'un parmak izleriyle karşılaştırır.

## Yerleşim

| Yol | İçerik |
|---|---|
| `site/*.html` | her sayfa bir dosya |
| `site/js/layout.js` | menü, başlık, kutular, sınama soruları; site haritası (`NAV`) |
| `site/js/lib/db.js` | sayfa başına bir PostgreSQL (PGlite), COMPANY kurulumu, komut çalıştırma |
| `site/js/lib/sqlbox.js` | düzenlenebilir, çalıştırılabilir SQL kutuları |
| `site/js/lib/sqlcore.js` | komut ayırma ve notebook'un kontrolcüsü (DOM'suz; testler de kullanır) |
| `site/js/lib/erd.js` | ER/EER diyagramları (SVG) |
| `site/js/lib/exercises.js`, `exam-problems.js` | notebook alıştırmaları ve rehber problemleri |
| `test/` | `node --test` testleri |
| `.github/workflows/pages.yml` | test, build ve GitHub Pages'e yayın |

## Yayın

İş akışı her push'ta test ve build yapar; yalnızca `main` dalından yayın yapar. Depo ayarlarında
**Settings → Pages → Source: GitHub Actions** seçilmelidir. Site `https://<owner>.github.io/database-systems/` adresinde yayınlanır.
