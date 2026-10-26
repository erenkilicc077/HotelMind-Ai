# HotelMind AI — projeyi anlama ve tezde anlatma

## Projenin problemi

Otel rezervasyonlarının bir kısmı geliş tarihinden önce iptal olur. Bu belirsizlik, talep planlamasını ve gelir yönetimini etkiler. HotelMind AI, rezervasyon özellikleriyle iptal olasılığı arasında ilişki öğrenir; çalışan bu ilişkiyi normal bir formdan inceleyebilir.

**Araştırma sorusu:** Geliş tarihine göre ayrılmış geçmiş otel rezervasyonlarında dört sınıflandırma yaklaşımı nasıl karşılaştırılır ve seçilen modelin bireysel tahminleri nasıl açıklanabilir?

Şu an iptal riski modülü var. Doluluk tahmini, dinamik fiyatlama, rezervasyon/PMS entegrasyonu ve AI agent bu sürümün tamamlanmış özellikleri değildir.

## Veri modelden nasıl sonuca dönüşüyor?

1. `data.py` kaynak CSV'yi okur ve geçersiz rezervasyonları eler.
2. Kayıtlar geliş tarihine göre sıralanır. Aynı gün parçalanmadan eğitim, doğrulama ve test bölümleri oluşturulur.
3. `modeling.py` sayısal ve kategorik girdileri ön işler: medyan/standartlaştırma ve en sık kategori/one-hot.
4. Dört algoritma aynı eğitim ve doğrulama bölümleriyle denenir. Model seçiminin ölçütü doğrulama Average Precision değeridir.
5. Seçilen algoritma eğitim ve doğrulama ile yeniden eğitilir. Nihai test sonuçları hesaplanır ve kaydedilir.
6. Paneldeki 17 alan, aynı özellik sırasıyla modele gönderilir. `/predict`, olasılık, sınıf, risk bandı ve SHAP döndürür.
7. Ağaç başına SHAP katkıları toplanır. Kategorik sütunlar özgün başlıklara geri gruplanır.

## Algoritmaların rolü

| Algoritma | Neden karşılaştırılıyor? |
|---|---|
| Logistic Regression | Doğrusal, açıklaması kolay bir temel seviye sunar. |
| Random Forest | Farklı karar ağaçlarını birleştirir; doğrusal olmayan ilişkileri öğrenir. |
| XGBoost | Ardışık ağaçlarla önceki hataları düzeltir; tablo verisinde güçlü bir karşılaştırmadır. |
| Çok katmanlı algılayıcı (MLP) | 64 ve 32 nöronlu iki gizli katmanla sinir ağı karşılaştırması sağlar. |

MLP kullanmak, projenin tümünün bir deep learning ürünü olduğunu göstermez. Bu sürümde seçilen model **Random Forest**. XGBoost'un sırf daha popüler olduğu için seçilmemesi, deney mantığının bir parçasıdır.

## Bu sürümün ölçülen sonucu

119.390 kayıttan 118.564'ü kaldı. Eğitim 82.937; doğrulama 17.758; test 17.869. Eğitim sonu 10 Şubat 2017, doğrulama sonu 21 Mayıs 2017, test sonu 31 Ağustos 2017.

| Ölçüt | Doğrulama (RF) | Ayrı test (RF) |
|---|---:|---:|
| ROC-AUC | 0,825543 | 0,777688 |
| Average Precision | 0,796726 | 0,728006 |
| Precision @ 0,50 | 0,986210 | 0,869933 |
| Recall @ 0,50 | 0,336710 | 0,276433 |
| F1 @ 0,50 | 0,502021 | 0,419549 |

Testte 10.512 doğru negatif, 292 yanlış pozitif, 5.112 yanlış negatif ve 1.953 doğru pozitif var. %50 eşikte yakalama oranı düşük. ROC-AUC'yi “%77,8 doğruluk” diye anlatmak yanlıştır; ROC-AUC ile accuracy farklı ölçütlerdir. Bu modelin test accuracy değeri yaklaşık **%69,76**.

AP farkı RF ile XGBoost arasında küçük. Tek veri bölünmesiyle anlamlı üstünlük iddiası kurulamaz. Test dönemindeki düşüş, zamansal genellemenin ayrıca araştırılması gerektiğini gösterir.

## SHAP'ı nasıl açıklayacağım?

Varsayılan yaz tatili örneğinde modelin temel olasılığı yaklaşık %36,85. Tüm girdilerin pozitif/negatif katkı toplamı yaklaşık +6,05 yüzde puanı. Sonuç yaklaşık %42,90.

Bu katkılar modelin neden bu sayıyı verdiğini açıklar. “Ön süreyi değiştirirsem iptal gerçekten şu kadar azalır” şeklinde bir nedensellik yorumu yapılmaz. Aynı alana ait birden fazla one-hot katkı toplanarak sunulur; bu işlem özgün kategoriler için ayrı bir nedensel/koalisyon modeli kurmaz.

## Öğretim üyesinin sorabileceği sorular

**Neden test verisinden model seçmedin?** Test, bilinmeyen son dönem için nihai değerlendirmedir. Model seçiminde kullanılırsa tarafsızlığını yitirir.

**Neden tarihe göre böldün?** Geçmişten geleceğe genellemeyi, rastgele bölmeye kıyasla daha görünür kılar. Ancak veri tam olay günlüğü olmadığı için bu yine retrospektif bir ölçümdür.

**Veri sızıntısını tamamen önledin mi?** Hayır. Sonuç alanlarını dışladık ve ön işleme eğitim içinde yapılıyor. Fakat kaynak snapshot'ların rezervasyon anını temsil ettiği garanti değil. ADR ve depozito değişmiş olabilir; sonuç etiketlerinin ne zaman öğrenildiği ayrıca modellenmedi.

**%50 neden seçildi?** Başlangıç prototipinin sabit eşiği. Ticari optimum iddiası yok. Doğrulama döneminde maliyet temelli eşik seçimi ve kalibrasyon sonraki deneyin konusu.

**Antalya için kullanılabilir mi?** Bu çalışma, Antalya başarısını kanıtlamıyor. Kendi otel verisi, zamana duyarlı etiketleme, kalibrasyon ve izinli bir PMS entegrasyonu gerekir.

**Gerçekten çalışan bir model mi?** Evet. Yerel form Python API'sine bağlı. Çevrimiçi sürüm aynı modelin ağaçlarını ve aynı ön işlemeyi tarayıcıda çalıştırıyor. Gerçek veri örnekleri üzerinde Python/JS olasılıkları ve SHAP katkıları otomatik karşılaştırıldı.

## Önerilen tez bölümleri

1. Problem ve otelcilik bağlamı
2. Sınıflandırma, dengesiz veri ve açıklanabilir yapay zekâ
3. Veri kaynağı, girdi sözleşmesi ve sınırlamalar
4. Deney tasarımı, ön işleme ve algoritmalar
5. Doğrulama karşılaştırması ve ayrı test bulguları
6. API ve arayüz uygulaması
7. Tartışma: düşük recall, kalibrasyon ve snapshot sızıntısı
8. Gelecek çalışmalar ve sonuç

Yazarken her tabloyu güncel `models/metrics.json` ile karşılaştır. Veri veya ayarlar değişirse eski sonuçları yeni eğitim için kullanma.
