# Geliştirme notları

Bu dosya sitenin nasıl çalıştığını ve nasıl geliştirileceğini anlatır. Siteyi kullanmak için [README](../README.md) yeterlidir.

## SQL kutuları

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

## MySQL motoru

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
| `site/js/lib/decide.js` | "Sen karar ver" oynatıcısı; adım adım SQL çözümleri ve geri alınan transaction içinde önce → sonra gösterimi |
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

## Şemalar ve yerleşim

- ER/EER diyagramları `site/js/lib/erd.js` ile SVG olarak çizilir; ilişki elmasları etiketin yaklaşık 1,5 katı genişliktedir.
- Otomatik yerleşim (`erlayout.js`) birkaç başlangıç ve düğüm değiş tokuşu dener, `layoutScore` ile (üst üste binen şekiller, kesişen
  çizgiler, bir şeklin içinden geçen çizgiler) en iyisini seçer. Elle verilen yerleşimler (COMPANY, Ch 9'un tek şeması) skoru 0 olacak
  biçimde seçilmiştir.
- Sözlük (`site/js/lib/glossary.js`) özet kâğıdının sözlüğünden ve sayfaların "Terimler tek bakışta" listelerinden üretilir; layout.js
  terimlerin altını çizer ve tanımı gösterir.
