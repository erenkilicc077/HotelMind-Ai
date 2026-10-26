# HotelMind AI v0.2 — buradan başla

Bu sürümde Swagger yerine gerçek bir panel var. Eğitilmiş model de ZIP'in içinde; tekrar eğitim yapmadan ilk analizi görebilirsin.

## En kolay açılış

1. ZIP'i eski projenin üzerine çıkarmak yerine yeni bir klasöre ayıkla.
2. İçindeki `hotelmind-ai` klasörüne gir.
3. `RUN_HOTELMIND.cmd` dosyasına çift tıkla.
4. İlk açılışta paketler kurulur. Ardından panel tarayıcıda otomatik açılır. Terminal açık kalsın.

Python 3.12 kullanılır. Zaten kurduğun 3.12 ile çalışır. Terminal etkinleştirme ve PowerShell güvenlik ayarıyla uğraşman gerekmiyor. İnternet yalnızca ilk kurulumdaki paket indirmeleri için gerekli; model ve veri pakette hazır.

Port 8000 doluysa başlatıcı 8001–8010 aralığında boş bir port seçer ve doğru adresi açar. İşin bitince terminalde **Ctrl+C** ile durdurabilirsin.

## Panelde sırayla ne yapacaksın?

- **Rezervasyon analizi:** Yaz tatili örneği ilk açılışta gerçek modelle hesaplanır. Kendi alanlarını değiştirip “İptal riskini analiz et”e bas. Bilgi değişince önceki sonucun güncel olmadığı belirtilir.
- **Bu tahmini neler etkiledi?:** Kırmızı katkı modelin tahminini artırır, yeşil katkı azaltır. Random Forest için değerler yüzde puanıdır. Temel olasılık ve tüm katkıların toplamı nihai olasılığı verir.
- **Genel bakış:** Kaynak verinin aylık dağılımını ve gözlenen iptal oranını gör. Bunlar canlı otel doluluğu değildir.
- **Model laboratuvarı:** Dört algoritmanın doğrulama karşılaştırması ve seçilen modelin ayrı test sonucu. ROC-AUC yüksek olsa bile recall düşük olabilir; ikisini birlikte anlat.
- **Analiz geçmişi:** Butona basarak yaptığın analizler bu tarayıcıda saklanır. İlk otomatik örnek geçmişe eklenmez. Bir kaydı forma geri alabilir veya CSV indirebilirsin.
- **CSV ile toplu analiz:** Önce örnek şablonu indir. Aynı 17 sütunu kullan. En fazla 500 kayıt ve 2 MB dosya kabul edilir. Alan adları ve kategori kodları şablondaki İngilizce biçimde kalmalı.

## VS Code ile açmak

VS Code → File → Open Folder → `hotelmind-ai`. Terminalde:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-tested.txt
.\.venv\Scripts\python.exe -m pip install -e ".[dev]" -c requirements-tested.txt
.\.venv\Scripts\python.exe -m hotelmind.launcher
```

Mevcut sanal ortamını kullanıyorsan ilk satırı tekrar çalıştırmana gerek yok. Yeni paket sürümlerini yükleyen diğer satırlar gerekli.

## Modeli kendin yeniden eğitmek

```powershell
.\.venv\Scripts\python.exe scripts/train.py --data data/raw/hotel_bookings.csv
.\.venv\Scripts\python.exe scripts/export_dashboard.py
.\.venv\Scripts\python.exe -m pytest -q
```

Yerel panel ve API yeni Python modelini kullanır. Çevrimiçi sürümü güncellemek için yeni dışa aktarılmış dosyaların ayrıca yayımlanması gerekir. Git'ten kopyaladıysan, eğitim öncesi `scripts/download_data.py` ile veri setini indir.

## Çıktıyı doğru yorumla

Örnek yaz tatili için bu sürümde yaklaşık **%42,90** hesaplanır. Bu, %50 sınıf eşiğinin altında olduğu için sınıf “iptal beklenmiyor”, %30–65 aralığında olduğu için risk “orta”dır. Risk bandı ile ikili sınıf farklı eşiklere dayanır.

Bu model geçmiş Portekiz verisinde ölçüldü; Antalya'da doğrulanmış bir ticari ürün değildir. %50 eşikte test recall **%27,64**: birçok iptal yakalanamıyor. Projeyi anlatırken bunu saklama; bir sonraki araştırma adımının neden gerekli olduğunu açıklar.

## Bir sorun olursa

- Python 3.12 bulunamadı: `py list` ile kontrol et. Gerekirse `py install 3.12`.
- Paket kurulumu durdu: Terminaldeki ilk hata satırını incele; başlatıcıyı tekrar açmak kurulumu yeniden dener.
- Panelde “model bulunamadı”: ZIP tamamen ayıklanmış mı, `models/cancellation_pipeline.joblib` var mı kontrol et. Git'ten klonlanan sürüm için önce eğitim gerekir.
- 422: Swagger'da artık geçerli örnek hazır. Normal panel eksik misafir ve geceyi istek göndermeden bildirir.
- Eski sürüm açılıyor: Eski terminali Ctrl+C ile kapat; yeni `hotelmind-ai` klasöründeki başlatıcıyı aç.
