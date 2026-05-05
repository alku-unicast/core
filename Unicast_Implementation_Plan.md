# UniCast — Detaylı Uygulama Planı
**Versiyon:** 2.0 | **Tarih:** Mayıs 2026

> Bu plan; ağ dayanıklılığı (offline fallback), Linux pencere modu uyarısı, Windows CMD sorunu, favori oda önbellekleme ve genel UI/UX geliştirmelerini kapsar. Her adım dosya yolu, fonksiyon adı ve mantık akışı düzeyinde yazılmıştır.

---

## İçindekiler

1. [Favoriler Mevcut Durumu & Mimari Kararı](#1-favoriler)
2. [Ağ Katmanı — 3 Seviyeli Durum Tespiti](#2-ag-katmani)
3. [Tauri (Rust) Backend Değişiklikleri](#3-rust-backend)
4. [Zustand Store Güncellemeleri](#4-zustand-stores)
5. [React Servis Katmanı](#5-servis-katmani)
6. [Yeni Bileşenler (Components)](#6-yeni-bilessenler)
7. [Mevcut Ekranların Güncellenmesi](#7-mevcut-ekranlar)
8. [Linux Pencere Modu Uyarı Modalı](#8-linux-modal)
9. [Windows CMD Penceresi Düzeltmesi](#9-windows-cmd)
10. [Doğrulama Planı](#10-dogrulama)
11. [Bağımlılık Haritası (Hangi dosya neyi etkiliyor)](#11-bagimlilik-haritasi)

---

## 1. Favoriler — Mevcut Durum & Mimari Karar

### 1.1 Mevcut Durum Tahmini

Eğer favoriler şu an Tauri'nin `plugin-store` (`tauri-plugin-store`) ya da `localStorage` ile tutuluyorsa:

```
src/stores/roomStore.ts
  → favoriteRooms: Room[]   ← Zustand state
  → localStorage veya @tauri-apps/plugin-store ile persist
```

Gemini'nin önerdiği `saveIpToLocalHistory()` benzeri bir yaklaşım ya da favori toggle butonu muhtemelen zaten var.

### 1.2 Mimari Karar: Ne Kullanacağız?

**Seçim: `@tauri-apps/plugin-store` (Tauri Store) — JSON dosyasına yazar**

Neden `localStorage` değil?
- `localStorage` tarayıcı ortamına bağlıdır, Tauri webview sıfırlandığında silinebilir.
- Tauri Store, `AppData/Roaming/unicast/rooms_cache.json` gibi kalıcı bir dosyaya yazar.
- Rust tarafından da okunabilir (ihtiyaç olursa).

**Veri Yapısı:**

```typescript
// src/types/room.ts — mevcut tipi genişlet
export interface Room {
  id: string;           // Firebase document ID
  name: string;         // "B203 - Bilgisayar Mühendisliği"
  ip: string;           // "10.50.0.113"
  building?: string;
  floor?: number;
  lastSeen?: number;    // YENİ: Unix timestamp — Firebase'den son güncellenme zamanı
  isFavorite?: boolean; // YENİ: Favori mi?
}

// Tauri Store'da saklanan yapı
export interface RoomsCache {
  rooms: Room[];
  lastUpdated: number;  // Unix timestamp
  version: number;      // Şema versiyonu — ilerideki migration için
}
```

### 1.3 Favori Güncelleme Akışı (Senkronizasyon)

**Soru: "Her uygulama açıldığında arka planda Firebase'den çekip local dosyayı güncellemek çok wait yükü oluşturur mu?"**

**Cevap: Hayır, eğer doğru yapılırsa.**

Önerilen strateji:

```
Uygulama açılır
    ↓
1. Tauri Store'dan cache'i OKU → UI'ı ANINDA göster (bekleme yok)
    ↓
2. ARKA PLANDA Firebase'den fresh listeyi çek (kullanıcı beklemez)
    ↓
3. Firebase başarılı gelirse:
   - cache'i güncelle (IP değiştiyse favori odayı da güncelle)
   - UI'ı sessizce yenile (skeleton yok, sadece değişen odalar güncellenir)
    ↓
4. Firebase başarısız gelirse:
   - Cache'teki veriyi kullanmaya devam et
   - NetworkState'i LOCAL_ONLY veya NO_NETWORK yap
```

Bu pattern **"Stale-While-Revalidate"** olarak bilinir, app store uygulamalarının tamamı böyle çalışır.

---

## 2. Ağ Katmanı — 3 Seviyeli Durum Tespiti

### 2.1 Durum Tanımları

```typescript
// src/types/network.ts — YENİ DOSYA
export type NetworkState = 
  | 'CHECKING'    // İlk kontrol yapılıyor
  | 'ONLINE'      // Firebase erişilebilir, tam çevrimiçi
  | 'LOCAL_ONLY'  // LAN var, internet yok (Firebase timeout)
  | 'NO_NETWORK'; // Hiç ağ yok (Wi-Fi kapalı, ethernet yok)

export interface NetworkInfo {
  state: NetworkState;
  localIp: string | null;        // "10.50.0.113" veya null
  hasLocalInterface: boolean;    // En az 1 non-loopback IP var mı?
  firebaseReachable: boolean;
  lastChecked: number;           // Unix timestamp
}
```

### 2.2 Kontrol Algoritması (Sıralı)

```
Adım 1: Rust'a "get_local_ip" isteği gönder
  → 127.0.0.1 dışında bir IP dönüyorsa: hasLocalInterface = true
  → Dönmüyorsa: NetworkState = NO_NETWORK → DUR

Adım 2: Firebase'e 3 saniyelik timeout ile istek at
  → Başarılı: NetworkState = ONLINE
  → Timeout/Hata: NetworkState = LOCAL_ONLY
```

---

## 3. Tauri (Rust) Backend Değişiklikleri

### 3.1 `src-tauri/src/commands/network.rs` — GÜNCELLE

**Mevcut durumda muhtemelen bir `get_local_ip` veya benzeri fonksiyon yok. Tamamen yeni eklenecek.**

```rust
// src-tauri/src/commands/network.rs

use std::net::UdpSocket;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct NetworkInfo {
    pub has_local_interface: bool,
    pub local_ip: Option<String>,
}

/// Cihazın yerel ağ IP'sini tespit eder.
/// Google DNS'e (8.8.8.8:80) bağlanmaya çalışarak
/// sistemin hangi arayüzü kullanacağını öğrenir.
/// Gerçek bir paket GÖNDERMEz, sadece route'u öğrenir.
#[tauri::command]
pub async fn get_network_info() -> Result<NetworkInfo, String> {
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            match socket.connect("8.8.8.8:80") {
                Ok(_) => {
                    match socket.local_addr() {
                        Ok(addr) => {
                            let ip = addr.ip().to_string();
                            // 127.x.x.x loopback'i hariç tut
                            if ip.starts_with("127.") {
                                Ok(NetworkInfo {
                                    has_local_interface: false,
                                    local_ip: None,
                                })
                            } else {
                                Ok(NetworkInfo {
                                    has_local_interface: true,
                                    local_ip: Some(ip),
                                })
                            }
                        }
                        Err(e) => Err(format!("local_addr error: {}", e)),
                    }
                }
                Err(_) => {
                    // UDP connect başarısız = ağ arayüzü yok veya tamamen offline
                    Ok(NetworkInfo {
                        has_local_interface: false,
                        local_ip: None,
                    })
                }
            }
        }
        Err(e) => Err(format!("socket bind error: {}", e)),
    }
}
```

**`src-tauri/src/lib.rs` veya `main.rs`'te command'i kaydet:**

```rust
.invoke_handler(tauri::generate_handler![
    // ... mevcut command'ler ...
    commands::network::get_network_info,  // YENİ
])
```

### 3.2 `src-tauri/src/commands/firebase.rs` — GÜNCELLE

**Mevcut `reqwest` isteğine timeout ekle:**

```rust
// Mevcut kod içinde, HTTP client oluşturma kısmını bul ve güncelle:

use std::time::Duration;

let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(3))  // ← BU SATIRI EKLE
    .build()
    .map_err(|e| e.to_string())?;
```

> ⚠️ Eğer mevcut kodda `reqwest::get()` kısa yolu kullanılıyorsa, önce `Client::builder()` ile client oluşturulmalı.

### 3.3 `src-tauri/src/commands/stream.rs` — GÜNCELLE (Windows CMD Sorunu)

**GStreamer process spawn kısmını bul — büyük ihtimalle şöyle bir şey var:**

```rust
// MEVCUT (Windows'ta CMD penceresi açar):
let child = Command::new(&gstreamer_path)
    .args(&gst_args)
    .spawn()
    .map_err(|e| e.to_string())?;
```

**Güncelle:**

```rust
// GÜNCEL (Windows'ta gizli çalışır):
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

let mut cmd = Command::new(&gstreamer_path);
cmd.args(&gst_args);

#[cfg(target_os = "windows")]
{
    // CREATE_NO_WINDOW = 0x08000000
    // DETACHED_PROCESS = 0x00000008  
    // İkisini birden kullanalım — hem pencere açılmasın hem de parent process'e bağlı kalmasın
    cmd.creation_flags(0x08000000 | 0x00000008);
}

let child = cmd.spawn().map_err(|e| e.to_string())?;
```

> Not: Bu değişiklik sadece `#[cfg(target_os = "windows")]` bloğu içinde olduğu için Linux ve Mac build'lerini etkilemez.

---

## 4. Zustand Store Güncellemeleri

### 4.1 `src/stores/networkStore.ts` — YENİ DOSYA

```typescript
// src/stores/networkStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { NetworkState, NetworkInfo } from '../types/network';

interface NetworkStore {
  networkState: NetworkState;
  localIp: string | null;
  hasLocalInterface: boolean;
  
  // Actions
  checkNetworkState: () => Promise<NetworkState>;
  setNetworkState: (state: NetworkState) => void;
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  networkState: 'CHECKING',
  localIp: null,
  hasLocalInterface: false,

  checkNetworkState: async (): Promise<NetworkState> => {
    set({ networkState: 'CHECKING' });
    
    try {
      // Adım 1: Rust'tan yerel ağ bilgisini al
      const netInfo = await invoke<{ has_local_interface: boolean; local_ip: string | null }>(
        'get_network_info'
      );
      
      if (!netInfo.has_local_interface) {
        set({ 
          networkState: 'NO_NETWORK', 
          localIp: null,
          hasLocalInterface: false 
        });
        return 'NO_NETWORK';
      }
      
      set({ localIp: netInfo.local_ip, hasLocalInterface: true });
      
      // Adım 2: Firebase erişilebilirliğini kontrol et
      // Bu check roomStore.ts içindeki fetchRooms'un zaten yapacağı şey
      // Buradan sadece networkState'i ONLINE veya LOCAL_ONLY olarak set et
      // Asıl Firebase call roomStore'da yapılacak
      
      return 'ONLINE'; // geçici, roomStore sonucu güncelleyecek
      
    } catch (error) {
      set({ networkState: 'NO_NETWORK', localIp: null, hasLocalInterface: false });
      return 'NO_NETWORK';
    }
  },
  
  setNetworkState: (state: NetworkState) => set({ networkState: state }),
}));
```

### 4.2 `src/stores/roomStore.ts` — GÜNCELLE

**Mevcut store'a eklenecekler (mevcut kodları silme, bunları entegre et):**

```typescript
// src/stores/roomStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store'; // Tauri Store plugin
import type { Room, RoomsCache } from '../types/room';
import { useNetworkStore } from './networkStore';

const STORE_FILE = 'rooms_cache.json';
const CACHE_KEY = 'rooms_cache';
const FIREBASE_TIMEOUT_MS = 3000;

interface RoomStore {
  rooms: Room[];
  favoriteRoomIds: Set<string>;
  isLoadingFromCache: boolean;
  isRefreshingFromFirebase: boolean;
  lastCacheUpdate: number | null;
  
  // Actions
  initializeRooms: () => Promise<void>;
  toggleFavorite: (roomId: string) => Promise<void>;
  saveCacheToStore: (rooms: Room[]) => Promise<void>;
  loadCacheFromStore: () => Promise<Room[]>;
  connectToRoom: (targetIp: string, roomId?: string) => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: [],
  favoriteRoomIds: new Set(),
  isLoadingFromCache: false,
  isRefreshingFromFirebase: false,
  lastCacheUpdate: null,

  initializeRooms: async () => {
    const { setNetworkState } = useNetworkStore.getState();
    
    // === ADIM 1: Cache'ten ANINDA yükle (kullanıcı beklemez) ===
    set({ isLoadingFromCache: true });
    const cachedRooms = await get().loadCacheFromStore();
    if (cachedRooms.length > 0) {
      set({ rooms: cachedRooms, isLoadingFromCache: false });
    } else {
      set({ isLoadingFromCache: false });
    }
    
    // === ADIM 2: Arka planda Firebase'den güncelle ===
    set({ isRefreshingFromFirebase: true });
    
    try {
      // 3 saniyelik timeout ile Firebase'den çek
      const firebaseRooms = await Promise.race([
        invoke<Room[]>('fetch_firebase_rooms'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('FIREBASE_TIMEOUT')), FIREBASE_TIMEOUT_MS)
        )
      ]);
      
      // Firebase başarılı: IP'leri güncelle, cache'i yaz
      const mergedRooms = mergeWithFavorites(firebaseRooms, get().favoriteRoomIds);
      set({ rooms: mergedRooms, isRefreshingFromFirebase: false });
      await get().saveCacheToStore(mergedRooms);
      setNetworkState('ONLINE');
      
    } catch (error: any) {
      set({ isRefreshingFromFirebase: false });
      
      if (error.message === 'FIREBASE_TIMEOUT' || error.message?.includes('network')) {
        // LAN var ama internet yok
        setNetworkState('LOCAL_ONLY');
      } else {
        // Bilinmeyen hata — cache'teki veriye güven
        console.error('Firebase fetch error:', error);
      }
    }
  },

  loadCacheFromStore: async (): Promise<Room[]> => {
    try {
      const store = await load(STORE_FILE, { autoSave: false });
      const cache = await store.get<RoomsCache>(CACHE_KEY);
      
      if (!cache || !cache.rooms) return [];
      
      // Cache çok eskiyse (7 günden fazla) uyarı verebiliriz ama yine de göster
      set({ lastCacheUpdate: cache.lastUpdated });
      
      // Favori ID'leri de restore et
      const favoriteIds = new Set(
        cache.rooms
          .filter(r => r.isFavorite)
          .map(r => r.id)
      );
      set({ favoriteRoomIds: favoriteIds });
      
      return cache.rooms;
    } catch (error) {
      console.error('Cache load error:', error);
      return [];
    }
  },

  saveCacheToStore: async (rooms: Room[]) => {
    try {
      const store = await load(STORE_FILE, { autoSave: false });
      const cache: RoomsCache = {
        rooms,
        lastUpdated: Date.now(),
        version: 1,
      };
      await store.set(CACHE_KEY, cache);
      await store.save();
    } catch (error) {
      console.error('Cache save error:', error);
    }
  },

  toggleFavorite: async (roomId: string) => {
    const { favoriteRoomIds, rooms } = get();
    const newFavorites = new Set(favoriteRoomIds);
    
    if (newFavorites.has(roomId)) {
      newFavorites.delete(roomId);
    } else {
      newFavorites.add(roomId);
    }
    
    const updatedRooms = rooms.map(r => ({
      ...r,
      isFavorite: newFavorites.has(r.id),
    }));
    
    set({ favoriteRoomIds: newFavorites, rooms: updatedRooms });
    await get().saveCacheToStore(updatedRooms); // Favoriyi kalıcı yaz
  },

  // HEM Firebase IP'si HEM manuel IP ile aynı akışı kullan
  connectToRoom: async (targetIp: string, roomId?: string) => {
    // Bu fonksiyon streamStore veya connectionStore'a taşınabilir
    // Ama mimari olarak şöyle çalışmalı:
    
    // 1. WAKE sinyali gönder (Agent'a ulaş)
    // 2. Agent HDMI-CEC'yi tetikler, PIN ekrana yansır
    // 3. READY cevabı gelince PIN modal'ını aç
    // 4. PIN doğrulanınca GStreamer başlat
    
    // Bu logic zaten başka bir store/service'te olmalı,
    // burada sadece IP'yi geçiyoruz:
    await invoke('send_wake_signal', { ip: targetIp });
  },
}));

// Helper: Firebase'den gelen listeyi favori bilgisiyle birleştir
function mergeWithFavorites(firebaseRooms: Room[], favoriteIds: Set<string>): Room[] {
  return firebaseRooms.map(room => ({
    ...room,
    isFavorite: favoriteIds.has(room.id),
    lastSeen: Date.now(),
  }));
}
```

### 4.3 `src/stores/settingsStore.ts` — GÜNCELLE

**Linux modal için yeni alan ekle:**

```typescript
// settingsStore.ts içinde mevcut interface'e ekle:
interface SettingsStore {
  // ... mevcut alanlar ...
  hideLinuxWindowWarning: boolean;  // YENİ
  
  // Actions
  setHideLinuxWindowWarning: (value: boolean) => Promise<void>;
}

// Store içine ekle:
hideLinuxWindowWarning: false,

setHideLinuxWindowWarning: async (value: boolean) => {
  set({ hideLinuxWindowWarning: value });
  // Tauri Store'a kaydet (settings_store.json dosyasına)
  const store = await load('settings_store.json', { autoSave: false });
  await store.set('hideLinuxWindowWarning', value);
  await store.save();
},

// initializeSettings (uygulama açılışında çağrılan fonksiyon) içine ekle:
const hideWarning = await store.get<boolean>('hideLinuxWindowWarning');
set({ hideLinuxWindowWarning: hideWarning ?? false });
```

---

## 5. Servis Katmanı

### 5.1 `src/services/networkService.ts` — YENİ DOSYA

```typescript
// src/services/networkService.ts

import { useNetworkStore } from '../stores/networkStore';
import { useRoomStore } from '../stores/roomStore';

/**
 * Uygulama açıldığında bir kere çağrılan ana başlatma fonksiyonu.
 * Önce ağı kontrol eder, sonra oda listesini yükler.
 */
export async function initializeApp(): Promise<void> {
  const { checkNetworkState } = useNetworkStore.getState();
  const { initializeRooms } = useRoomStore.getState();
  
  // 1. Yerel ağ varlığını kontrol et
  const networkState = await checkNetworkState();
  
  if (networkState === 'NO_NETWORK') {
    // Oda yüklemeye bile çalışma, kullanıcıya Wi-Fi uyarısı göster
    // NetworkState zaten set edildi, UI bunu okuyacak
    return;
  }
  
  // 2. Odaları yükle (cache'ten anında + Firebase'den arka planda)
  await initializeRooms();
}

/**
 * Periyodik olarak çağrılabilir (opsiyonel — şimdilik gerekli değil).
 * Arka planda ağ durumunu kontrol eder.
 */
export async function refreshNetworkStatus(): Promise<void> {
  const { checkNetworkState } = useNetworkStore.getState();
  await checkNetworkState();
}
```

---

## 6. Yeni Bileşenler (Components)

### 6.1 `src/components/layout/StatusBanner.tsx` — YENİ DOSYA

**Tasarım kuralları:**
- `NO_NETWORK`: Kırmızı arka plan, X ikonu, Wi-Fi açma talimatı
- `LOCAL_ONLY`: Sarı/turuncu arka plan, uyarı ikonu, "Çevrimdışı mod" bilgisi
- `ONLINE` + `isRefreshingFromFirebase`: Küçük mavi spinner (göze batmayan)
- `ONLINE`: Hiçbir şey gösterme

```tsx
// src/components/layout/StatusBanner.tsx
import React from 'react';
import { useNetworkStore } from '../../stores/networkStore';
import { useRoomStore } from '../../stores/roomStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

export function StatusBanner() {
  const { networkState } = useNetworkStore();
  const { isRefreshingFromFirebase, lastCacheUpdate } = useRoomStore();
  const { language } = useSettingsStore();
  
  const t = translations[language];
  
  if (networkState === 'ONLINE' && !isRefreshingFromFirebase) return null;
  
  // Cache yaşını hesapla
  const cacheAge = lastCacheUpdate 
    ? Math.floor((Date.now() - lastCacheUpdate) / 60000) // dakika cinsinden
    : null;
  
  return (
    <div className={`status-banner ${networkState.toLowerCase()}`} role="alert">
      {networkState === 'NO_NETWORK' && (
        <>
          <WifiOff size={16} />
          <span>{t.noNetwork}</span>
        </>
      )}
      
      {networkState === 'LOCAL_ONLY' && (
        <>
          <AlertTriangle size={16} />
          <span>
            {t.localOnly}
            {cacheAge !== null && ` (${t.lastUpdated}: ${cacheAge} ${t.minutesAgo})`}
          </span>
        </>
      )}
      
      {networkState === 'ONLINE' && isRefreshingFromFirebase && (
        <>
          <RefreshCw size={14} className="spin" />
          <span>{t.refreshing}</span>
        </>
      )}
    </div>
  );
}

const translations = {
  tr: {
    noNetwork: 'Ağ bağlantısı bulunamadı. Lütfen Wi-Fi\'yi açın ve Eduroam\'a bağlanın.',
    localOnly: 'İnternet bağlantısı yok. Önbelleğe alınmış odalar gösteriliyor.',
    lastUpdated: 'Son güncelleme',
    minutesAgo: 'dakika önce',
    refreshing: 'Oda listesi güncelleniyor...',
  },
  en: {
    noNetwork: 'No network connection. Please enable Wi-Fi and connect to Eduroam.',
    localOnly: 'No internet connection. Showing cached rooms.',
    lastUpdated: 'Last updated',
    minutesAgo: 'min ago',
    refreshing: 'Refreshing room list...',
  },
};
```

**CSS (mevcut global.css veya component'a özel):**

```css
.status-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 8px;
  margin: 8px 16px;
  transition: all 0.3s ease;
}

.status-banner.no_network {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.status-banner.local_only {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.status-banner.online {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

/* Dark mode */
[data-theme="dark"] .status-banner.no_network {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### 6.2 `src/components/rooms/ManualConnectSection.tsx` — YENİ DOSYA

**Bu bileşen `RoomDiscovery` ekranının ALT kısmında her zaman gösterilecek.**
`LOCAL_ONLY` durumunda daha belirgin, `ONLINE`'da küçük/gizli olabilir.

```tsx
// src/components/rooms/ManualConnectSection.tsx
import React, { useState } from 'react';
import { useNetworkStore } from '../../stores/networkStore';
import { useRoomStore } from '../../stores/roomStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Network, ArrowRight, AlertCircle } from 'lucide-react';

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export function ManualConnectSection() {
  const [ip, setIp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { networkState, hasLocalInterface } = useNetworkStore();
  const { connectToRoom } = useRoomStore();
  const { language } = useSettingsStore();
  const t = translations[language];
  
  // Wi-Fi yoksa bu bileşeni gösterme
  if (networkState === 'NO_NETWORK' || !hasLocalInterface) return null;
  
  const isValidIp = IP_REGEX.test(ip) && ip.split('.').every(part => parseInt(part) <= 255);
  const isLocalOnly = networkState === 'LOCAL_ONLY';
  
  const handleConnect = async () => {
    if (!isValidIp) {
      setError(t.invalidIp);
      return;
    }
    
    setError(null);
    setIsConnecting(true);
    
    try {
      await connectToRoom(ip);
    } catch (err: any) {
      setError(err.message || t.connectionFailed);
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <div className={`manual-connect-section ${isLocalOnly ? 'prominent' : 'subtle'}`}>
      <div className="manual-connect-header">
        <Network size={16} />
        <span>{t.manualConnect}</span>
        {isLocalOnly && (
          <span className="offline-badge">{t.offlineMode}</span>
        )}
      </div>
      
      <div className="manual-connect-input-row">
        <input
          type="text"
          value={ip}
          onChange={(e) => {
            setIp(e.target.value);
            setError(null);
          }}
          placeholder={t.ipPlaceholder}
          className={`ip-input ${error ? 'error' : ''}`}
          onKeyDown={(e) => e.key === 'Enter' && isValidIp && handleConnect()}
        />
        
        <button
          onClick={handleConnect}
          disabled={!isValidIp || isConnecting}
          className="connect-button"
        >
          {isConnecting ? (
            <span className="loading-dots">{t.connecting}</span>
          ) : (
            <>
              {t.connect}
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="manual-connect-error">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
      
      <p className="manual-connect-hint">{t.hint}</p>
    </div>
  );
}

const translations = {
  tr: {
    manualConnect: 'Manuel Bağlantı',
    offlineMode: 'Çevrimdışı',
    ipPlaceholder: 'Ör: 10.50.0.113',
    connect: 'Bağlan',
    connecting: 'Bağlanıyor',
    invalidIp: 'Geçerli bir IP adresi girin.',
    connectionFailed: 'Cihaza ulaşılamadı. IP adresini kontrol edin.',
    hint: 'Hedef odanın ekranındaki IP adresini girin.',
  },
  en: {
    manualConnect: 'Manual Connection',
    offlineMode: 'Offline',
    ipPlaceholder: 'e.g. 10.50.0.113',
    connect: 'Connect',
    connecting: 'Connecting',
    invalidIp: 'Please enter a valid IP address.',
    connectionFailed: 'Could not reach device. Check the IP address.',
    hint: 'Enter the IP address shown on the target room\'s screen.',
  },
};
```

### 6.3 `src/components/modals/LinuxWarningModal.tsx` — YENİ DOSYA

```tsx
// src/components/modals/LinuxWarningModal.tsx
import React, { useState } from 'react';
import { Monitor, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface LinuxWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LinuxWarningModal({ isOpen, onClose }: LinuxWarningModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { setHideLinuxWindowWarning, language } = useSettingsStore();
  const t = translations[language];
  
  if (!isOpen) return null;
  
  const handleConfirm = async () => {
    if (dontShowAgain) {
      await setHideLinuxWindowWarning(true);
    }
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleConfirm()}>
      <div className="linux-warning-modal">
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon-wrapper warning">
            <Monitor size={24} />
          </div>
          <button className="modal-close-btn" onClick={handleConfirm}>
            <X size={18} />
          </button>
        </div>
        
        {/* Content */}
        <div className="modal-content">
          <h2 className="modal-title">{t.title}</h2>
          <p className="modal-description">{t.description}</p>
          
          <div className="modal-tip-box">
            <span className="tip-icon">💡</span>
            <span>{t.tip}</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="modal-footer">
          <label className="dont-show-again-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="checkbox"
            />
            <span>{t.dontShowAgain}</span>
          </label>
          
          <button
            onClick={handleConfirm}
            className="modal-confirm-btn"
          >
            {t.understood}
          </button>
        </div>
      </div>
    </div>
  );
}

const translations = {
  tr: {
    title: 'Ekran Modu Uyarısı',
    description: 'Linux\'ta en iyi deneyim için lütfen uygulamayı tam ekran modunda başlatın. Yayın sırasında pencereyi yeniden boyutlandırmaktan kaçının; bu durum yayının kesilmesine neden olabilir.',
    tip: 'Tam ekrana geçmek için F11 tuşuna basabilir veya pencere kontrollerini kullanabilirsiniz.',
    dontShowAgain: 'Bir daha hatırlatma',
    understood: 'Anladım',
  },
  en: {
    title: 'Window Mode Warning',
    description: 'For the best experience on Linux, please launch the application in fullscreen mode. Avoid resizing the window during a broadcast, as this may interrupt the stream.',
    tip: 'Press F11 or use window controls to enter fullscreen mode.',
    dontShowAgain: 'Don\'t show this again',
    understood: 'Got it',
  },
};
```

**Modal CSS (tasarıma uygun, turuncu tonları — UniCast'in renk paleti):**

```css
/* LinuxWarningModal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.linux-warning-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-icon-wrapper.warning {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.modal-close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.modal-close-btn:hover { opacity: 1; }

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 10px;
}

.modal-description {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin: 0 0 16px;
}

.modal-tip-box {
  background: var(--color-surface-hover);
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  gap: 12px;
}

.dont-show-again-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox {
  accent-color: var(--color-primary); /* Turuncu */
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.modal-confirm-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.modal-confirm-btn:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## 7. Mevcut Ekranların Güncellenmesi

### 7.1 `src/screens/RoomDiscovery.tsx` — GÜNCELLE

**Eklenecekler:**
1. `StatusBanner` bileşenini en üste ekle
2. Oda listesini favori ve diğer şeklinde iki gruba böl (favoriler üstte)
3. `ManualConnectSection` bileşenini en alta ekle
4. `NO_NETWORK` durumunda oda listesini gizle

```tsx
// RoomDiscovery.tsx içine ekle (mevcut return/JSX'i güncelle):

import { StatusBanner } from '../components/layout/StatusBanner';
import { ManualConnectSection } from '../components/rooms/ManualConnectSection';
import { useNetworkStore } from '../stores/networkStore';
import { useRoomStore } from '../stores/roomStore';

// Component içinde:
const { networkState } = useNetworkStore();
const { rooms, favoriteRoomIds } = useRoomStore();

const favoriteRooms = rooms.filter(r => favoriteRoomIds.has(r.id));
const otherRooms = rooms.filter(r => !favoriteRoomIds.has(r.id));

return (
  <div className="room-discovery-screen">
    
    {/* Ağ durumu banner — sadece sorun varsa görünür */}
    <StatusBanner />
    
    {/* Oda listesi — NO_NETWORK'te gizle */}
    {networkState !== 'NO_NETWORK' && (
      <>
        {/* Favoriler — her zaman önce göster */}
        {favoriteRooms.length > 0 && (
          <section className="room-section">
            <h3 className="section-title">{t.favorites}</h3>
            {favoriteRooms.map(room => <RoomCard key={room.id} room={room} />)}
          </section>
        )}
        
        {/* Diğer odalar */}
        {otherRooms.length > 0 && (
          <section className="room-section">
            <h3 className="section-title">
              {favoriteRooms.length > 0 ? t.allRooms : t.rooms}
            </h3>
            {otherRooms.map(room => <RoomCard key={room.id} room={room} />)}
          </section>
        )}
        
        {/* Cache yükleniyor ama liste henüz boş */}
        {rooms.length === 0 && networkState === 'LOCAL_ONLY' && (
          <div className="empty-cache-message">{t.noCachedRooms}</div>
        )}
      </>
    )}
    
    {/* Manuel bağlantı — alt kısım, her zaman (NO_NETWORK hariç) */}
    <ManualConnectSection />
    
  </div>
);
```

### 7.2 `src/screens/ConnectionSetup.tsx` — GÜNCELLE

**Linux modal tetikleme:**

```tsx
import React, { useEffect, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { LinuxWarningModal } from '../components/modals/LinuxWarningModal';
import { useSettingsStore } from '../stores/settingsStore';

// Component içinde:
const [showLinuxWarning, setShowLinuxWarning] = useState(false);
const { hideLinuxWindowWarning, displayMode } = useSettingsStore();
// displayMode = 'fullscreen' | 'windowed' — mevcut store'dan gelmeli

useEffect(() => {
  const checkLinuxWarning = async () => {
    const os = await platform(); // 'linux' | 'windows' | 'macos'
    
    if (
      os === 'linux' &&
      displayMode === 'windowed' &&
      !hideLinuxWindowWarning
    ) {
      setShowLinuxWarning(true);
    }
  };
  
  checkLinuxWarning();
}, [displayMode, hideLinuxWindowWarning]);

// Return içinde:
return (
  <>
    {/* Mevcut ConnectionSetup içeriği */}
    
    {/* Eski turuncu uyarıyı SİL, yerine modal kullan */}
    <LinuxWarningModal
      isOpen={showLinuxWarning}
      onClose={() => setShowLinuxWarning(false)}
    />
  </>
);
```

### 7.3 `src/screens/StreamingBarApp.tsx` (Mini Ada) — GÜNCELLE

**Mini ada, yayın sırasında ağ durumunu da göstermeli:**

```tsx
// Mevcut mini ada içeriğine ekle:
import { useNetworkStore } from '../stores/networkStore';

const { networkState } = useNetworkStore();

// Mini ada içinde küçük bir indicator:
{networkState === 'LOCAL_ONLY' && (
  <div className="mini-network-indicator local-only" title="İnternet bağlantısı yok">
    <WifiOff size={10} />
  </div>
)}

// Bu sadece görsel bir nokta/ikon olmalı, büyük yer kaplamamalı
// Çünkü mini ada zaten küçük
```

### 7.4 Kapalı Mini Ada (Gizli ekran) — GÜNCELLE

**Kullanıcı minik adayı kapattığında görünen ekranda da durum göstermeli:**

```tsx
// Bu genellikle ana window'un küçük bir state'te gösterdiği ekrandır
// Burada da networkState'e göre küçük bir badge göster:

{networkState !== 'ONLINE' && (
  <div className={`network-badge ${networkState.toLowerCase()}`}>
    {networkState === 'NO_NETWORK' ? <WifiOff size={12} /> : <AlertTriangle size={12} />}
  </div>
)}
```

---

## 8. Linux Pencere Modu Uyarı Modalı — Özet Akışı

```
Uygulama başlar
    ↓
ConnectionSetup mount olur
    ↓
platform() → 'linux' mı? ─── Hayır ──→ Devam (modal yok)
    ↓ Evet
displayMode === 'windowed'? ─── Hayır ──→ Devam
    ↓ Evet  
hideLinuxWindowWarning === false? ─── Hayır ──→ Devam
    ↓ Evet
LinuxWarningModal açılır
    ↓
Kullanıcı "Anladım" basar
    ├── "Bir daha hatırlatma" seçili → settingsStore'a kaydet, modal kapanır
    └── Seçili değil → sadece kapanır (bir sonraki pencere modunda tekrar açılır)
```

---

## 9. Windows CMD Penceresi — Özet

Tek dosya, tek değişiklik. `stream.rs` içindeki `Command::new(...).spawn()` çağrısına `creation_flags` ekle:

```rust
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Tüm GStreamer ve yardımcı process spawn noktalarını bul ve güncelle:
let mut cmd = Command::new(&binary_path);
cmd.args(&args);

#[cfg(target_os = "windows")]
cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

cmd.spawn()?;
```

> ⚠️ Projede birden fazla `Command::spawn()` çağrısı olabilir (GStreamer, ffmpeg, vb.). Her birini bul ve bu flag'i ekle.

---

## 10. Doğrulama Planı

### 10.1 Ağ Durumları

| Test | Nasıl Yapılır | Beklenen Sonuç |
|------|---------------|----------------|
| NO_NETWORK | Wi-Fi kapat | Kırmızı banner, oda listesi gizli, Manuel IP gizli |
| LOCAL_ONLY | Wi-Fi aç, routerin internet kablosunu çek | Sarı banner, cache'teki odalar görünür, Manuel IP açık |
| ONLINE | Normal | Banner yok, Firebase'den liste |
| Cache senkronizasyonu | ONLINE iken uygulama kapat, Wi-Fi kapat, yeniden aç | Cache'teki odalar görünmeli |
| Favori kalıcılığı | Bir odayı favorile, uygulamayı tamamen kapat, yeniden aç | Favori hâlâ işaretli |

### 10.2 Manuel IP Akışı

| Test | Beklenen |
|------|----------|
| Geçersiz IP formatı gir | Hata mesajı, Bağlan butonu disabled |
| Geçerli IP ama cihaz kapalı | "Cihaza ulaşılamadı" hatası |
| Geçerli IP, cihaz açık | WAKE → HDMI-CEC → PIN modal açılır |
| PIN modal açıldıktan sonra GStreamer | Yayın başlar, mini ada görünür |

### 10.3 Linux Modal

| Test | Beklenen |
|------|----------|
| Linux + Windowed mod, ilk açılış | Modal görünür |
| "Bir daha hatırlatma" seç → Anladım | Bir daha görünmez |
| "Bir daha hatırlatma" seçmeden Anladım | Bir sonraki windowed modda tekrar çıkar |
| Fullscreen mod | Modal çıkmaz |

### 10.4 Windows CMD

| Test | Beklenen |
|------|----------|
| Yayın başlat | Hiçbir CMD/terminal penceresi açılmamalı |
| Task Manager | GStreamer process arka planda görünmeli ama penceresi olmamalı |

---

## 11. Bağımlılık Haritası

```
Yeni Dosyalar:
├── src/types/network.ts
├── src/stores/networkStore.ts
├── src/services/networkService.ts
├── src/components/layout/StatusBanner.tsx
├── src/components/rooms/ManualConnectSection.tsx
└── src/components/modals/LinuxWarningModal.tsx

Güncellenen Dosyalar:
├── src/types/room.ts              (+lastSeen, +isFavorite)
├── src/stores/roomStore.ts        (+cache, +favorites, +initializeRooms)
├── src/stores/settingsStore.ts    (+hideLinuxWindowWarning)
├── src/screens/RoomDiscovery.tsx  (+StatusBanner, +ManualConnect, favori gruplama)
├── src/screens/ConnectionSetup.tsx (+LinuxWarningModal tetikleyici)
├── src/screens/StreamingBarApp.tsx (+ağ durumu indicator)
├── src-tauri/src/commands/network.rs  (+get_network_info command)
├── src-tauri/src/commands/firebase.rs (+3 saniyelik timeout)
├── src-tauri/src/commands/stream.rs   (+CREATE_NO_WINDOW Windows)
└── src-tauri/src/lib.rs            (+yeni command'i kaydet)

Uygulama Giriş Noktası:
└── src/App.tsx veya main.tsx       (+initializeApp() çağrısı)
```

---

## Sık Sorulan Sorular

**S: Firebase cache güncellemesi çok mu meşgul eder?**  
C: Hayır. Uygulama açıldığında sadece 1 kez Firebase isteği atılır. Bu istek arka planda, kullanıcı arayüzü bloklanmadan yapılır. Mikro saniyeler içinde tamamlanır. Tauri Store yazma işlemi de async'tir, UI'ı etkilemez.

**S: Mac'te çalışacak mı?**  
C: Tauri projesi zaten cross-platform. Ancak Mac'te dağıtmak için Apple Developer sertifikası ($99/yıl) ve bir macOS build makinesi gerekir. Aksi hâlde "App is damaged" uyarısı çıkar. Teknik kod değişikliği gerekmez, sadece build pipeline kurulumu.

**S: Windows virüs uyarısı?**  
C: Kod ile çözülemez. Microsoft Authenticode Code Signing Sertifikası satın alınması ve imzalama pipeline'ına entegre edilmesi gerekir. EV sertifika daha güvenilirdir (SmartScreen'i anında geçer), Standard sertifika zaman içinde güven kazanır.

**S: LAN çalışırken WAN giderse ve Pi'nin IP'si değişirse?**  
C: Pi'lere DHCP reservation (MAC-to-IP) veya statik IP atanması standart bir ağ yönetimi pratiğidir ve şiddetle önerilir. Cache'teki IP geçerliliğini korur. Aksi hâlde "Cihaza ulaşılamadı" hatası çıkar, kullanıcı manuel IP girme bölümünü kullanır.
