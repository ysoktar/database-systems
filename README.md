# Veritabanı Sistemleri: çalışma sitesi

BIL372/BIL071 Veritabanı Sistemleri (TOBB ETÜ, 2026–2027 Güz) için etkileşimli bir çalışma sitesi. Site, R. Elmasri & S. B. Navathe'nin
*Fundamentals of Database Systems* (7. baskı) kitabını, dersin slaytlarını ve müfredatını, ve ders notebook'unu
(`notebook/Ch6_7_SQL_Exercises.ipynb`, *Exercises — Chapters 6 and 7*) izler. Bütün sayfalar Türkçe ve İngilizcedir; başlıktaki
dünya düğmesi dili değiştirir ve okuyucuyu aynı bölümde tutar.

- **Bölüm sayfaları.** Ch 1–7: kavramlar, mimari, ER, EER, ilişkisel model ve kısıtlar, temel SQL, NULL ve iç içe sorgular,
  join/gruplama/WITH, assertion/trigger/view/ALTER. Ch 8: ilişkisel cebir (slaytlar 1–67). Ch 9: ER ve EER şemalarını tablolara
  eşleme (slaytlar 1–38). Ch 14: fonksiyonel bağımlılıklar ve normalizasyon, BCNF'e kadar (slaytlar 1–55); bir ilişkinin
  aday anahtarlarını ve normal formunu bulan, onu NJB testiyle adım adım ayrıştıran bir araçla. Ch 16: disk depolama,
  tamponlama, bloklama, heap/sıralı/hash dosyalar ve RAID (slaytlar 1–41). Ch 17: indeks türleri, çok seviyeli indeksler,
  B- ve B+-ağaçları, bitmap ve hash indeksler, fiziksel tasarım (slaytlar 1–41). Ch 20: transaction'lar, eşzamanlılık
  sorunları, ACID, kurtarılabilir ve serileştirilebilir çizelgeler, izolasyon seviyeleri (slaytlar 1–44). Kitabın COMPANY sorguları (Q0, Q1, …) çalıştırılabilir; ER/EER diyagramları kitaptaki gösterimle
  çizilir. Bir konunun müfredatta yalnızca bir kısmı varsa, sayfanın başında kapsadığı slayt aralığı yazar.
- **Önce ve sonra.** Adım adım gösterimlerde her adımın girdisi solda, sonucu sağda görünür: SQL'in kavramsal değerlendirme
  sırası, join türleri, ilişkisel cebirin her işlemi (atılan satırlar kırmızı, NULL ile kalanlar sarı), ER'den tablolara
  eşlemenin her adımı (tablonun önceki ve sonraki hâli) ve tablolardan ER'e geri dönüş.
- **Etkileşimli oynatıcılar.** Ch 9'da Adım 1–9'u tek şemada gösteren ve diyagramda o adımın yapısını vurgulayan oynatıcı
  (tahmin modu, büyütme ve tam ekran); Ch 14'te bağımlılık diyagramları, adım adım kapanış, anomali laboratuvarı ve
  normalizasyon oynatıcısı; Ch 16'da tampon değiştirme, bloklama, hashing ve RAID simülasyonları; Ch 17'de indeks türleri,
  maliyet hesaplayıcısı ve B+/B-ağacı ekleme oynatıcısı. Ch 20'de eşzamanlılık sorunları oynatıcısı, durum
  diyagramı ve öncelik grafını adım adım kuran çizelge analizcisi. "Sen karar ver" bölümleri her cevaptan sonra adım adım çözümü
  gösterir ve cevap sıfırlanabilir.
- **Notebook alıştırmaları**: notebook'taki 10 SQL alıştırması, notebook'takiyle aynı kontrolcüyle (aynı hash'ler; Python
  kontrolcüsü `site/js/lib/sqlcore.js`'e taşındı). İpuçları, doğrulanmış çözümler ve alternatifler.
- **Çalışma rehberi (Ch 1–7)**: bölüm bölüm bilinmesi gerekenler, çözümlü ER/kısıt/anahtar problemleri, otomatik kontrol
  edilen 8 SQL problemi, sık yapılan hatalar ve bütün sayfaların sorularından oluşan bir deneme seti.
- **ER stüdyosu**: ER/EER diyagramlarını sürükle-bırak ya da metinle çizme (iki görünüm eşitlenir; geri alma, otomatik
  yerleşim, 1/N ↔ (min,max) gösterimi, SVG/PNG ve paylaşım bağlantısı); diyagramı Ch 9 algoritmasıyla (adım 1–9,
  özelleştirme seçenekleri 8A–8D) adım adım tablolara dönüştürüp MySQL'de oluşturma; kendi `CREATE TABLE`'larınızı ER
  diyagramına geri çevirme (reverse engineering); 8 örnek şema ve otomatik kontrol edilen 4 ER tasarım alıştırması.
- **Araçlar**: SQL laboratuvarı (serbest konsol ve canlı şema tarayıcı), özet kâğıdı ve sözlük.

### SQL kutuları

Kutular satır numaralı bir editördür. Bir kelimenin üstüne gelmek ya da tıklamak ona ait olanı vurgular ve kodun altında
tek cümleyle açıklar: bir clause'un tamamı ve değerlendirme sırasındaki adımı, bir alt sorgu ve correlated olup olmadığı, bir
takma ad ve tablosu, bir sütunun tipi ve anahtar rolü, foreign key boyunca bir join koşulu. `= NULL` ve iki tabloda birden
bulunan sütun adları için uyarı verir. Hatalar MySQL'in yazdığı gibi gösterilir (`ERROR 1054 (42S22): Unknown column …`),
yanlış yazılmış bir ad için en yakın COMPANY adı önerilir ve hatalı satır kırmızıyla işaretlenir. Sınama sorularının
çoğunda, cevaptan sonra açılan bir "Kontrol edin" kutusu sorudaki sorguları çalıştırır.

Her SQL kutusu tarayıcıda çalışan bir MySQL'e bağlıdır: MySQL ile uyumlu
[go-mysql-server](https://github.com/dolthub/go-mysql-server)'ın WebAssembly derlemesi (`engine/`). Sunucu yoktur; site
statiktir ve hiçbir veri tarayıcıdan çıkmaz. COMPANY şeması ve verisi (Figure 6.1/6.2 ve Figure 5.6) notebook'un yardımcı
hücresinden alındı ve MySQL'e uyarlandı (`site/js/lib/company.js`). Her kutunun üstünde kullandığı tabloların adları vardır;
bir ada tıklamak o tablonun satırlarını açar. MySQL motoru (≈ 87 MB) içeriğinin özetiyle tarayıcının önbelleğinde tutulur; site yeniden yayınlandığında motor değişmediyse tekrar indirilmez. Sınama sorularında her seçeneğin neden doğru ya da yanlış olduğu yazar.

### MySQL motoru

`engine/build.sh` go-mysql-server'ı (v0.20.0) `GOOS=js GOARCH=wasm` ile derler; bağımlılıklar vendor'lanır ve MySQL'in
davranışına yaklaştırmak için birkaç yerinden yamalanır (ayrıntılar betikte): `ONLY_FULL_GROUP_BY` (hata 1055) ve primary key üzerinden fonksiyonel bağımlılık, correlated
`UNION/EXCEPT` içeren `EXISTS`, NULL döndüren alt sorguyla `NOT IN`, varsayılan collation (`utf8mb4_0900_ai_ci`), DATE'in
metin hâli. `site/js/lib/mysql.js` motoru başlatır ve `x > ALL (…)` / `x = ANY (…)` gibi karşılaştırmaları, motorun
ayrıştırıcısı desteklemediği için eşdeğer `EXISTS` biçimlerine çevirir. Bilinen eksikler: view üzerinden güncelleme yok,
`EXPLAIN` çıktısı gerçek MySQL'inkinden farklı biçimde.

## Geliştirme

Node 20 veya üstü ve Go 1.24 veya üstü gerekir.

```sh
npm run engine  # MySQL motorunu engine/dist/ altına derler (bir kez; engine/ değişince tekrar)
npm run dev     # site/ klasörünü http://localhost:8000 adresinde sunar
npm test        # alıştırma çözümleri MySQL'de, site yapısı, SQL yardımcıları
npm run build   # yayınlanacak siteyi dist/ klasörüne yazar
```

ER testleri her örneği 8A–8D seçenekleriyle eşleyip DDL'i MySQL motorunda çalıştırır, kitabın COMPANY DDL'ini ER'e geri
çevirir ve ER → tablo → ER gidiş-dönüşünün yapıyı koruduğunu doğrular. Testler ayrıca her model çözümü (notebook'un 10 alıştırması ve alternatifleri, rehberin 8 problemi) aynı motorda çalıştırır ve
notebook'un parmak izleriyle karşılaştırır.

## Yerleşim

| Yol | İçerik |
|---|---|
| `site/*.html` | her sayfa bir dosya (Türkçe); `site/en/*.html` İngilizce eşleri |
| `site/js/pages/` | sayfaya özgü betikler (adım adım gösterimler, sorgu ağacı, eşleme örnekleri) |
| `site/js/layout.js` | menü, başlık, kutular, sınama soruları; site haritası (`NAV`) |
| `engine/` | MySQL motoru: Go giriş noktası (`main.go`) ve derleme betiği |
| `site/js/lib/mysql.js` | motoru başlatma, `ALL`/`ANY` çevirisi |
| `site/js/lib/db.js` | sayfa başına bir MySQL, COMPANY kurulumu, komut çalıştırma |
| `site/js/lib/companydata.js` | COMPANY'nin Figure 5.6 verisi (kutuların tablo panelleri için) |
| `site/js/lib/sqlbox.js`, `codeview.js` | düzenlenebilir, çalıştırılabilir SQL kutuları; satır numaralı editör |
| `site/js/lib/sqllinks.js`, `errhelp.js` | bir kelimeye ait olanı bulma ve açıklama; MySQL biçiminde hatalar ve ad önerileri |
| `site/js/lib/fd.js` | fonksiyonel bağımlılıklar: kapanış, aday anahtarlar, 2NF/3NF/BCNF testleri, ayrıştırma, NJB, bağımlılıkların korunması |
| `site/js/lib/schedule.js` | transaction çizelgeleri: çakışmalar, öncelik grafı, serileştirilebilirlik, kurtarılabilirlik sınıfları |
| `site/js/lib/stepper.js` | önce → sonra gösterimli adım adım sorgu görünümleri |
| `site/js/lib/i18n.js`, `site/en/` | Türkçe/İngilizce metinler; her sayfanın İngilizce eşi |
| `site/js/lib/sqlcore.js` | komut ayırma ve notebook'un kontrolcüsü (DOM'suz; testler de kullanır) |
| `site/js/lib/erd.js` | ER/EER diyagramları (SVG) |
| `site/js/lib/ermodel.js` | ER modeli ve metin dili (ayrıştırma, doğrulama, geri yazma) |
| `site/js/lib/ermap.js` | ER/EER → ilişkisel eşleme (Ch 9) ve DDL |
| `site/js/lib/erreverse.js` | tablolar → ER (katalogdan reverse engineering) |
| `site/js/lib/erlayout.js`, `ereditor.js` | otomatik yerleşim ve etkileşimli editör |
| `site/js/lib/er-examples.js`, `er-exercises.js` | örnek şemalar, alıştırmalar ve yapısal karşılaştırma |
| `site/js/lib/exercises.js`, `exam-problems.js` | notebook alıştırmaları ve rehber problemleri |
| `test/` | `node --test` testleri |
| `.github/workflows/pages.yml` | motoru derleme, test, build ve GitHub Pages'e yayın |

## Yayın

İş akışı her push'ta test ve build yapar; yalnızca `main` dalından yayın yapar. Depo ayarlarında
**Settings → Pages → Source: GitHub Actions** seçilmelidir. Site `https://<owner>.github.io/database-systems/` adresinde yayınlanır.
