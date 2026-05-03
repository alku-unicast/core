şimdi windowst da firebase yüklenmedi.
şu ui'daki hata: "Firebase verisi çekilemedi. Rust köprüsü hatası.
Rooms willl appear here when projectors are online."
şu inceledeki hata: "index-DGIS2rWD.js:2710 [Firebase] Initializing app...
index-DGIS2rWD.js:2710 [Firebase] Attempting anonymous sign-in (5s timeout)...
index-DGIS2rWD.js:2710 [Firebase] Anonymous sign-in successful.
index-DGIS2rWD.js:2710 [RoomDiscovery] Firebase init finished.
index-DGIS2rWD.js:2710 [roomService] Fetching rooms via Rust...
index-DGIS2rWD.js:2710 [roomService] Failed to fetch rooms: JSON parsing error: error decoding response body
console.error @ index-DGIS2rWD.js:2710
index-DGIS2rWD.js:2710 [roomService] Fetching rooms via Rust...
index-DGIS2rWD.js:2710 [roomService] Failed to fetch rooms: JSON parsing error: error decoding response body
console.error @ index-DGIS2rWD.js:2710
r @ index-DGIS2rWD.js:2710
index-DGIS2rWD.js:2710 [roomService] Fetching rooms via Rust...
index-DGIS2rWD.js:2710 [roomService] Failed to fetch rooms: JSON parsing error: error decoding response body
console.error @ index-DGIS2rWD.js:2710
r @ index-DGIS2rWD.js:2710
index-DGIS2rWD.js:2710 [roomService] Fetching rooms via Rust...
"
ubuntu 22.04 live open in grub2 mode ile açıldı:
incelede bu yazdı:
"[Log] [Firebase] Initializing app... (index-BVZoZR6F.js, line 2710)
[Log] [Firebase] Attempting anonymous sign-in (5s timeout)... (index-BVZoZR6F.js, line 2710)
[Error] TypeError: undefined is not an object (evaluating 'gapi.iframes.getContext')
	callback (index-BVZoZR6F.js:1627:348)
	(anonymous function) (api.js:23:491)
	ja (api.js:16:704)
	B (api.js:23:475)
	(anonymous function) (api.js:24)
	(anonymous function) (api.js:24:130)
	Global Code (cb=gapi.loaded_0:1)
[Error] Error: t`tauri
	(anonymous function) (api.js:24:616)
	(anonymous function) (api.js:23:491)
	ja (api.js:16:704)
	B (api.js:23:475)
	(anonymous function) (api.js:24)
	(anonymous function) (api.js:24:130)
	Global Code (cb=gapi.loaded_1:1)
[Error] Cross-origin redirection to http://developers.google.com/ denied by Cross-Origin Resource Sharing policy: Origin tauri://localhost is not allowed by Access-Control-Allow-Origin. Status code: 301
[Error] XMLHttpRequest cannot load https://apis.google.com/_/jserror?script=https%3A%2F%2Fapis.google.com%2F_%2Fscs%2Fabc-static%2F_%2Fjs%2Fk%3Dgapi.lb.tr.4MXQGu0I8rs.O%2Fm%3Dgapi_iframes%2Frt%3Dj%2Fsv%3D1%2Fd%3D1%2Fed%3D1%2Frs%3DAHpOoo_fQOs6Gks4Y58un7dDCm8VKPiIBQ%2Fcb%3Dgapi.loaded_0&error=t%60tauri&line=157 due to access control checks.
[Error] Failed to load resource: Cross-origin redirection to http://developers.google.com/ denied by Cross-Origin Resource Sharing policy: Origin tauri://localhost is not allowed by Access-Control-Allow-Origin. Status code: 301 (jserror, line 0)
[Warning] [Firebase] Auth failed or timed out, but proceeding anyway: – Error: Firebase auth timeout (5s) (index-BVZoZR6F.js, line 2710)
Error: Firebase auth timeout (5s)
[Log] [RoomDiscovery] Firebase init finished. (index-BVZoZR6F.js, line 2710)
[Log] [roomService] Fetching rooms via Rust... (index-BVZoZR6F.js, line 2710)
[Error] [roomService] Failed to fetch rooms: – "JSON parsing error: error decoding response body"
	(anonymous function) (index-BVZoZR6F.js:2710:13665)
	(anonymous function) (index-BVZoZR6F.js:2710:4446)
> Selected Element
< <div class="flex flex-col items-center justify-center gap-3 px-8 text-center">…</div>
[Log] [roomService] Fetching rooms via Rust... (index-BVZoZR6F.js, line 2710)
[Error] [roomService] Failed to fetch rooms: – "JSON parsing error: error decoding response body"
	(anonymous function) (index-BVZoZR6F.js:2710:13665)
	(anonymous function) (index-BVZoZR6F.js:2710:4446)",

ui'de windowstakinin aynısı:\"Firebase verisi çekilemedi. Rust köprüsü hatası.
Rooms willl appear here when projectors are online.\"

terminalde ise: "ubuntu@ubuntu:~/İndirilenler$ ./UniCast_0.1.0_amd64.AppImage 
[2026-05-03T10:36:01Z ERROR unicast_lib] [frontend] [roomService] Failed to fetch rooms: JSON parsing error: error decoding response body
"