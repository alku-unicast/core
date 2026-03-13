# Olası Sorunlar, Çözümler ve Gelecek Planlar

## 1. İkinci Ekran (Extend) Modu

**Sorun:**  
Windows ve macOS gibi sistemlerde görüntüyü “Uzat” modunda kullanmak için ikinci bir monitör tanıtmak gerekiyor.  
Bu genelde admin izni ve sertifika isteyen sanal sürücüler kurmayı gerektiriyor.  
Üstelik bu sürücüler çöktüğünde sistemde “hayalet ekran” kalma riski var.  

**Çözüm:**  
Sanal ekran kurmaya çalışmak yerine, sadece öğretmenin seçtiği uygulamanın (örneğin PowerPoint) penceresi yakalanıyor.  
Böylece öğretmen ana ekranda başka şeyler yaparken, sadece sunum Pi’ye aktarılıyor.  
Ne sürücü kurulumu ne de admin izni gerekiyor.  

---

## 2. Projeksiyon ve Ağ Sorunları

**Sorun:**  
- Pi sürekli “Bekleme Ekranı” gösterdiğinde projeksiyon cihazlarının otomatik kaynak değiştirme özelliği bozuluyor.  
- Ekran tamamen kapatıldığında ise IP ve PIN görünmediği için kullanıcı bağlanamıyor.  
- Eduroam gibi kurumsal ağlarda “istemci izolasyonu” yüzünden cihazlar birbirini bulamıyor.  

### Çözüm A: Bulut Üzerinden İletişim
- Yerel ağda cihazlar birbirini göremediği için iletişim katmanı Firebase gibi bir bulut veritabanına taşınıyor.  
- Hem Pi hem Windows uygulaması HTTPS üzerinden buluta bağlanıyor, cihaz keşfi saniyeler içinde çözülüyor.  

**HDMI Yönetimi:**  
- Pi’nin HDMI çıkışı yayın yokken tamamen kapalı tutuluyor.  
- Öğretmen “Bağlan” dediğinde Pi açılıyor, projeksiyona PIN kodu yansıtıyor.  
- Böylece sadece sınıfta olan kişi şifreyi görebiliyor.  

**HDMI-CEC ile Donanımsal Kontrol:**  
- Pi, projeksiyona doğrudan “HDMI 2’ye geç” komutu gönderebiliyor.
- Kumanda taşıma ihtiyacı ortadan kalkıyor.
- Fakat bu bir varsayım, gerçekte projeksiyon bunu destekleyecek mi denememiz gerekiyor.

---

### Çözüm B: Eski Yöntem
- Pi sürekli idle ekranı açık tutuyor, IP ve PIN gösteriyor.  
- Hocalar kumanda ile aç/kapa ve kaynak değiştirme işlemlerini manuel yapıyor.  
