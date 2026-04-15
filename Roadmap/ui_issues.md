yeni sorun:
pencere modunda mesela yputube'dan video açtım alt tab ile başka yere gittiğimde youtube'daki yayın donuyor görüntü donuyor temrianlde de şöyle  hata veriyor:
"12672 000002B63EA9C320 WARN
3d11device0» DXGIInfoQueue: Live ID3D11Device at
12672 000002B63EA9C320 WARN
3d11deviceD DXGIInfoQueue: Live ID3D11Device at
12672 000002B63EA9C320 WARN
device_handle: D3D11 cali failed: Ox80004002, B”yle bir arabirim desteklenmiyor
12672 000002B63EA9C320 WARN
3d11device2» DXGIInfoQueue: Live ID3D11Device at
3 11 e ug ayer gst 3 11 evıce. cpp.
Ox000002B63E7A9320, Refcount: 3
d3d11debugIayer gstd3d11device.
Ox000002B63ED9F990, Refcount: 3
d3d11device gstd3d11device.
Ox000002B63E7A9320, Refcount: 3
• 779:gst_ 3 11
• 779 : gst_d3d11
evıce ıspose:«
_device_dispose : 4d
cpp.
cpp.
d3d11debugIayer gstd3d11device. cpp:
• 1372 : gst_d3d11_device_get_video
Use Windows high-resolution clock, precision: 1 ms
Setting pipeline to PAUSED .
Pipeline is live and does not need PREROLL .
Got context from element 'd3d11downIoad0' : gst.d3d11.device.handIe—context,
d3d11device3” ,
n)true, ”N'IDX Graphics” ;
Pipeline is PREROLLED .
Setting pipeline to PLAYING
Redistribute latency...
Redistribute latency...
New clock: GstAudioSrcCIock
Redistribute latency...
Redistribute latency...
Redistribute latency...
12672 000002B63E95BC70 ERROR
d3d11debugIayer gstd3d11memory. cpp:441: gst_d3d11 allocate_staging_
textureKd3d11device3» D3D111nfoQueue: ID3D11DeviceContext: :CopySubresourceRegion: pSrcBox is not a valid box for the so
urce subresource. *pSrcBox left:0, top:0, front:0, right:1920, bottom:1048, back:l SrcSubresource
f left:0, top
front:0, right:1920, bottom: 1030, back:l J.
Redistribute latency...
12672 000002B63E95BC70 ERROR
d3d11debugIayer gstd3d11memory.
cess Md3d11device3) D3D111nfd2ueue: ID3D11DeviceContext: :CopySubresourceRegion: pSrcBox is not a valid
e subresource.
*pSrcBox f left:0, top:0, front:0, right:1920, bottom:1048, back:l ). SrcSubresource
front:0, right: 1920, bottom: 1030, back:l
12672 000002B63E95BC70 ERROR
d3d11debugIayer gstd3d11memory. cpp:460: gst_d3d11
cess Md3d11device3) D3D111nfd2ueue: ID3D11DeviceContext: :CopySubresourceRegion: pSrcBox is not a valid
e subresource.
*pSrcBox f left:0, top:0, front:0, right:1920, bottom:1048, back:l ). SrcSubresource
front:0, right: 1920, bottom: 1030, back:l ).
box for the sourc
f left:0, top:0,
box for the sourc
f left:0, top:0," (bu şekilde sürekli devam ediyor. yazım hataları olabilir.)

build alınan uygulamada komut istemi açılıyor. Output burada geliyor. Şu an bugfix için mükemmel ama final sürümünde  kapatılması gerekiyor.
Yüzen ada yayın ekranına siyah olarak gidiyor.
Yüzen ada öenek veriyorum 400*20 boyutunda diyelim ama üsste de belirttiğim gib siha şerit de farz edelim 800*600 boyutunda. bu siyah şerit gönderici bilgisayarda görünmemesine rağmen tıklanabilir şekilde bilmem anlatabildim mi.

başka bir windows'a kurdum uygulamayı. "gst-launch-1.0exe - Sistem Hatası
Kod yürütülmesi devam edemiyor çünkü VCRUNTIME140.dll bulunamadı. Programı yeniden başlatmak bu duurmu çözebilir." Yazıyor. bilgisayar sıfırdan yeni kuruldu windows update dışında herhangi bir yükeleme de yapılmadı ondan kaynaklı olabilir ama bu duruma da hazılanmalıyız en azından kulalnıcılara şunları yükle demeliyiz.

# UI Sorunları — 2026-04-14

## ✅ ÇÖZÜLENLER

1. **stopStream ana ekranda tanımsız** — ConnectionSetup.tsx:288
   - Mini adadaki fonksiyon çalışıyordu, ana ekranda tanımsızdı
   - Artık her iki tarafta da çalışıyor

3. **PIN giriş focus sorunu** — PINEntry.tsx
   - `autoFocus={i === 0}` native prop'a geçildi
   - RegEx filtre eklendi (rakam dışı girişler engellendi)

4. **Tema senkronizasyonu** — StreamingBar ayarlardan kapanınca tema kayboluyordu
   - `settings-updated` event'i eklendi, mini bar anında `loadFromDisk()` yapıyor

5. **Durdurma sonrası state asılı kalması** — stream-mode-info event listener
   - `setStopping(false)` ve `setAudioPopupOpen(false)` eklendi

6. **GStreamer nvh264enc crash** — tune=zerolatency parametresi hatalı format
   - `encoder_params()` fonksiyonu ile tüm encoder'lar için doğru parametreler tanımlandı

---

## ⚠️ DEVAM EDENLER

### 1. Mini Ada Kapalıyken Ana Ekranda Eksik Widget'lar

**Beklenen davranış:** Mini ada kapalıysa, ana ekrandaki "Yayında" panelinde ses slider ve network health gözükmesi gerekiyor.

**Durum:** Kısmi çözüm — stop butonu var ama ses/network eksik. Daha fazla widget eklenmesi gerekiyor.

---

### 2. Translucent Dark = Normal Dark (Görsel fark yok)
**Sorun:** `SettingsModal.tsx`'te bar theme seçiminde "translucent-dark" ile "dark" arasında görsel olarak hiçbir fark yok.

**Durum:** Beklemede — kullanıcı geri bildirimi bekleniyor.

---

### 3. Mod Değiştirme Butonu (TAM/Pencere)
**Sorun:** Mini adada mod değiştirme tıklandığında pencere seçim menüsü null hwnd ile açılmaya çalışıyordu.

**Mevcut çözüm:** Buton pasif bırakıldı (sadece indicator). Tam mod/window değişikliği için yayın durdurulup baştan başlatılması gerekiyor.

**Alternatif:** Ana pencere açılıp oradan seçim yaptırılabilir.

---

## 📋 YAPILACAKLAR LİSTESİ (Priority)

### P0 — Kritik
- [ ] **\\?\ path hatası** — GStreamer çalışmıyor (stream.rs debug'da)
- [ ] **Encoder detection doğrulaması** — Farklı donanımlarda test edilmeli

### P1 — Yüksek
- [ ] Mini ada kapalıyken ana ekranda ses slider ve network health widget'ları ekle
- [ ] Audio device ID'nin gerçekten pipeline'a aktarıldığını doğrula
- [ ] Encoder detection'ı `d3d11screencapturesrc` ile test et (videotestsrc yerine)

### P2 — Orta
- [ ] Translucent dark görsel fark
- [ ] macOS'ta ses yakalama (BlackHole opsiyonu)
- [ ] GStreamer thinning (bin/ ve lib/ temizliği)

### P3 — Düşük
- [ ] Mod değiştirme butonu (mini ada içinde)
- [ ] i18n (TR/EN dil desteği) — Faz 2'de tamamlanmadı
- [ ] RSA auth — Faz 0'da planlandı ama yapılmadı
