# DevTools Kapatma Rehberi

Sorun çözüldüğünde DevTools'ı kapatmak için aşağıdaki adımları izle:

## 1. Cargo.toml Dosyasını Düzenle

`app/src-tauri/Cargo.toml` dosyasını aç ve `"devtools"` feature'ını kaldır:

```toml
# ÖNCEKİ (Açık):
tauri = { version = "2", features = [
  "tray-icon",
  "image-png",
  "devtools",  # <-- BU SATIRI SİL
] }

# SONRAKİ (Kapalı):
tauri = { version = "2", features = [
  "tray-icon",
  "image-png",
] }
```

## 2. tauri.conf.json Dosyasını Düzenle

`app/src-tauri/tauri.conf.json` dosyasını aç ve `build` bölümünden `"devtools": true` satırını kaldır:

```json
// ÖNCEKİ:
"build": {
  "frontendDist": "../dist",
  "devUrl": "http://localhost:5173",
  "beforeDevCommand": "npm run dev",
  "beforeBuildCommand": "npm run build",
  "devtools": true  // <-- BU SATIRI SİL
},

// SONRAKİ:
"build": {
  "frontendDist": "../dist",
  "devUrl": "http://localhost:5173",
  "beforeDevCommand": "npm run dev",
  "beforeBuildCommand": "npm run build"
},
```

## 3. Build Temizleme (Önerilen)

Eski build dosyalarını temizlemek için:
```bash
cd app
npm run tauri build -- --clean
```

---

**Not:** Sorun tekrarlarsa aynı dosyaları tersine düzenleyerek DevTools'ı tekrar açabilirsin.
