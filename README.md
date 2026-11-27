# Veritabanı Sistemleri: çalışma sitesi

BIL372/BIL071 Veritabanı Sistemleri dersi için etkileşimli bir çalışma sitesi. R. Elmasri & S. B. Navathe'nin
*Fundamentals of Database Systems* (7. baskı) kitabını ve dersin slaytlarını izler; dersin bütün konularını kapsar.
Bütün sayfalar Türkçe ve İngilizcedir: başlıktaki dünya düğmesi dili değiştirir ve sizi aynı bölümde tutar.

**Site:** https://ysoktar.github.io/database-systems/

## Konular

| Bölüm | Sayfa |
|---|---|
| Ch 1–2 | Veritabanı ve DBMS; mimari, veri modelleri, üç-şema mimarisi, veri bağımsızlığı |
| Ch 3–4 | ER ve EER modeli: varlıklar, ilişkiler, kısıtlar, özelleştirme, kategoriler |
| Ch 5 | İlişkisel model, kısıtlar ve kısıt ihlalleri |
| Ch 6–7 | SQL: tanımlama, sorgular, NULL ve iç içe sorgular, join ve gruplama, assertion, trigger, view |
| Ch 8 | İlişkisel cebir ve sorgu ağaçları |
| Ch 9 | ER ve EER şemalarını tablolara eşleme (Adım 1–9) |
| Ch 11 | PHP ile web veritabanı programlama |
| Ch 14 | Fonksiyonel bağımlılıklar ve normalizasyon (1NF–BCNF) |
| Ch 16–17 | Disk depolama, dosyalar, hashing, RAID; indeksler, B- ve B+-ağaçları |
| Ch 20 | Transaction'lar, eşzamanlılık, kurtarılabilir ve serileştirilebilir çizelgeler |

Bir bölümün müfredatta yalnızca bir kısmı varsa, sayfanın başında hangi slaytları kapsadığı yazar.

## Her sayfada

- **Terimler tek bakışta:** sayfanın terimleri birer cümleyle; metindeki terimlerin altı kesikli çizilidir, üstüne gelince tanımı açılır.
- **Konu anlatımı:** kitabın COMPANY örnekleri, şemalar ve adım adım gösterimler. Her adımın önceki ve sonraki hâli yan yana görünür.
- **Çalışan SQL:** her SQL kutusu tarayıcınızda çalışan bir MySQL'e bağlıdır; sorguları değiştirip hemen çalıştırabilirsiniz.
  Veriyi bozarsanız "Veritabanını sıfırla" her şeyi kitaptaki hâline döndürür.
- **Etkileşimli araçlar:** ER'den tablolara eşleme oynatıcısı, normalizasyon aracı, B+-ağacı oynatıcısı, indeks maliyeti
  hesaplayıcısı, disk ve tampon simülasyonları, çizelge analizcisi ve diğerleri.
- **Sen karar ver:** her cevaptan sonra adım adım çözüm; veri değiştiren komutlar gerçekten çalışır ve geri alınır.
- **Kendinizi sınayın:** her seçeneğin neden doğru ya da yanlış olduğunu açıklayan kısa sorular.

## Diğer sayfalar

- **Çalışma rehberleri:** Ch 1–7 ve bütün ders için; bölüm bölüm bilinmesi gerekenler, soru tiplerine yaklaşım, çözümlü problemler ve deneme setleri.
- **Notebook alıştırmaları:** ders notebook'undaki 10 SQL alıştırması, notebook'takiyle aynı kontrolcüyle.
- **ER stüdyosu:** ER/EER diyagramı çizme, tablolara dönüştürme ve tablolardan diyagrama geri dönme.
- **SQL laboratuvarı** ve **özet kâğıdı ile sözlük**.

## Notlar

Bu site resmî ders materyali değildir; ders slaytlarının ve kitabın yerini tutmaz. Site tamamen statiktir: sunucu yoktur
ve hiçbir veri tarayıcınızdan çıkmaz. İlk SQL çalıştırmasında MySQL motoru tarayıcınıza indirilir, sonra önbellekte kalır.

Siteyi yerelde çalıştırmak ve geliştirmek için: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
