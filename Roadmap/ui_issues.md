yayın ekranına geldikten sonra uyarı ekranı çıktı: "
gst-launch-1.0.exe- Giriş Noktası Bulunamadı
X
_std_parallel_algorithms_hw_threads yordam giriş noktası, C:\Users\ALKU/AP \AppData\Local\UniCast\GSTREA~1\windows\bi n\d3dcompiler 47.dll dinamik bağlantı kitaplığında bulunamadı.
Tamam"
yayın başlata tıkladım ama  yine aynı hatayı verdi tamam'a bastım terminal ekranında  yayın başlıyor gibi oluyor ama tabii gerçekte yok: 
"
** (gst-launch-1.0:7048): WARNING **: 14:50:46.782: "dx9screencapsrc" is deprecated and will be removedin the future. Use "d3d11screencapturesrc" element instead
Use Windows high-resolution clock, precision: 1 ms
Setting pipeline to PAUSED ...
Pipeline is live and does not need PREROLL ...
Pipeline is PREROLLED ...
Setting pipeline to PLAYING ...
New clock: GstSystemClock
Redistribute latency...
Redistribute latency...
0:01:28.1 / 99:99:99."

şu da log doasyası: "0:00:01.928969800  1880 0000020F508750C0 FIXME                default gstutils.c:4090:gst_element_decorate_stream_id_internal:<dx9screencapsrc0> Creating random stream-id, consider implementing a deterministic way of creating a stream-id
9F30 WARN             d3d12device gstd3d12device.cpp:738:gst_d3d12_device_new_internal: Could not find adapter, hr: 0x887a0002
0:00:00.303755200  5712 000001D43FAB9F30 WARN                 default ges-meta-container.c:237:_set_value:<GESAsset@000001D443FC05C0> Could not set value on item: format-version
0:00:00.303823000  5712 000001D43FAB9F30 WARN                 default ges-meta-container.c:237:_set_value:<GESAsset@000001D443FC0640> Could not set value on item: format-version
0:00:00.303871600  5712 000001D43FAB9F30 WARN                 default ges-meta-container.c:237:_set_value:<GESAsset@000001D443FC06C0> Could not set value on item: format-version
0:00:00.304504200  5712 000001D43FAB9F30 WARN               structure gststructure.c:2371:priv_gst_structure_parse_fields: Failed to find delimiter, r=mimetype
0:00:00.333391600  5712 000001D43FAB9F30 WARN                 default gstjackloader.c:187:gst_jack_load_library: Could not open library libjack64.dll, 'libjack64.dll': Belirtilen modül bulunamadı.
0:00:00.333434600  5712 000001D43FAB9F30 WARN                 default gstjack.c:108:plugin_init: Failed to load jack library
0:00:00.338299400  5712 000001D43FAB9F30 WARN                  ladspa gstladspa.c:509:plugin_init:<plugin113> no LADSPA plugins found, check LADSPA_PATH
0:00:00.943842900  5712 000001D43FAB9F30 WARN             mftransform gstmftransform.cpp:1223:gst_mf_transform_set_output_type: MediaFoundation call failed: 0xc00d36b4, Medya türü için belirtilen veri geçersiz, tutarsız veya bu nesne tarafından desteklenmiyor.
0:00:00.960293500  5712 000001D443FB8580 WARN             mftransform gstmftransform.cpp:513:gst_mf_transform_thread_func:<mftransform3> No available device at index 0
0:00:00.984684700  5712 000001D443FB85C0 WARN             mftransform gstmftransform.cpp:513:gst_mf_transform_thread_func:<mftransform4> No available device at index 0
0:00:01.016537600  5712 000001D443FB8540 WARN             mftransform gstmftransform.cpp:513:gst_mf_transform_thread_func:<mftransform7> No available device at index 1
0:00:01.024165100  5712 000001D443FB84C0 WARN             mftransform gstmftransform.cpp:513:gst_mf_transform_thread_func:<mftransform9> No available device at index 1
0:00:01.030535000  5712 000001D443FB84C0 WARN             mftransform gstmftransform.cpp:920:gst_mf_transform_open_internal: MediaFoundation call failed: 0x80004002, Böyle bir arabirim desteklenmiyor
0:00:01.030579600  5712 000001D443FB84C0 WARN             mftransform gstmftransform.cpp:921:gst_mf_transform_open_internal:<mftransform10> ICodecAPI is unavailable
0:00:01.033754700  5712 000001D443FB8500 WARN             mftransform gstmftransform.cpp:920:gst_mf_transform_open_internal: MediaFoundation call failed: 0x80004002, Böyle bir arabirim desteklenmiyor
0:00:01.033793300  5712 000001D443FB8500 WARN             mftransform gstmftransform.cpp:921:gst_mf_transform_open_internal:<mftransform11> ICodecAPI is unavailable
0:00:01.055391500  5712 000001D43FAB9F30 WARN              cudaloader gstcudaloader.cpp:233:gst_cuda_load_library_once_func: Could not open library nvcuda.dll, 'nvcuda.dll': Belirtilen modül bulunamadı.
"

şu da yine güncel everything çıktısı (arama inputuna d3d11 yazınca):'"Adı","Yol","Boyut","Değiştirme Tarihi"
"amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21",,2026-04-14 18:47:09
"amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0",,2026-04-14 19:44:47
"wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21",,2026-04-14 18:47:09
"wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0",,2026-04-14 19:44:47
"amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4.manifest","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21",1955,2025-10-04 00:55:04
"amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4.manifest","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0",1955,2025-11-02 22:48:46
"d3d11.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_644b48c68303069f\f",120287,2025-04-08 17:46:32
"d3d11.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_6e9ff318b763c89a\f",56801,2025-04-08 15:51:10
"d3d11.dll","C:\Windows\System32",2504160,2026-04-14 18:51:23
"d3d11.dll","C:\Windows\SysWOW64",1963320,2026-04-14 18:52:16
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_644fe59a83008b98",2504040,2023-12-04 05:45:58
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_644fe59a83008b98\f",117114,2023-12-04 05:45:44
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_644fe59a83008b98\r",115566,2023-12-04 05:45:44
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_644b48c68303069f",2504160,2026-04-14 18:51:23
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_644b48c68303069f\f",120287,2025-04-08 17:46:32
"d3d11.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_644b48c68303069f\r",435570,2026-04-14 18:51:23
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_6ea48fecb7614d93",1964392,2023-12-04 05:46:45
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_6ea48fecb7614d93\f",45660,2023-12-04 05:46:43
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.3636_none_6ea48fecb7614d93\r",45147,2023-12-04 05:46:43
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_6e9ff318b763c89a",1963320,2026-04-14 18:52:16
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_6e9ff318b763c89a\f",56801,2025-04-08 15:51:10
"d3d11.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11_31bf3856ad364e35_10.0.19041.5794_none_6e9ff318b763c89a\r",291094,2026-04-14 18:52:16
"d3d11_3sdklayers.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21\amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4\f",18396,2025-04-08 17:46:28
"d3d11_3sdklayers.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21\wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf\f",8116,2025-04-08 15:51:00
"d3d11_3sdklayers.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\amd64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_cf7277d2411029e4\f",18396,2025-04-08 17:46:28
"d3d11_3sdklayers.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf\f",8116,2025-04-08 15:51:00
"d3d11on12.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_706a945efccf6941\f",26586,2025-04-08 17:46:28
"d3d11on12.dll","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_7abf3eb131302b3c\f",19640,2025-04-08 15:51:04
"d3d11on12.dll","C:\Windows\System32",597160,2026-04-14 18:51:23
"d3d11on12.dll","C:\Windows\SysWOW64",464408,2026-04-14 18:52:16
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_706f3132fcccee3a",596024,2023-12-04 05:45:58
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_706f3132fcccee3a\f",24958,2023-12-04 05:45:44
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_706f3132fcccee3a\r",23228,2023-12-04 05:45:44
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_706a945efccf6941",597160,2026-04-14 18:51:23
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_706a945efccf6941\f",26586,2025-04-08 17:46:28
"d3d11on12.dll","C:\Windows\WinSxS\amd64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_706a945efccf6941\r",70895,2026-04-14 18:51:23
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_7ac3db85312db035",463840,2023-12-04 05:46:45
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_7ac3db85312db035\f",13668,2023-12-04 05:46:43
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.3636_none_7ac3db85312db035\r",12664,2023-12-04 05:46:43
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_7abf3eb131302b3c",464408,2026-04-14 18:52:16
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_7abf3eb131302b3c\f",19640,2025-04-08 15:51:04
"d3d11on12.dll","C:\Windows\WinSxS\wow64_microsoft-windows-directx-direct3d11on12_31bf3856ad364e35_10.0.19041.5794_none_7abf3eb131302b3c\r",66351,2026-04-14 18:52:16
"gstd3d11-1.0-0.dll","C:\Users\ALKU\AppData\Local\UniCast\gstreamer\windows\bin",2514432,2025-06-16 18:43:42
"gstd3d11.dll","C:\Users\ALKU\AppData\Local\UniCast\gstreamer\windows\lib\gstreamer-1.0",1292288,2025-06-16 18:44:16
"wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf.manifest","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6456.1.21",1955,2025-10-04 00:55:16
"wow64_microsoft-windows-d..tx-d3d11_3sdklayers_31bf3856ad364e35_10.0.19041.5794_none_d9c722247570ebdf.manifest","C:\Windows\servicing\LCU\Package_for_RollupFix~31bf3856ad364e35~amd64~~19041.6466.1.0",1955,2025-11-02 22:49:00
' 

en son bunu yapmıştık git'ten bakabilirsin claude bir şeyler yaptı ama anlamadım kontrol edebilirsen iyi olur
ama birkaç hata var sanırım mesela pencere modunu seçtim tüm ekran geliyor o pencere değil bütün ekranı yansıtıyor.
ayrıca ses de yok hiçbir şekilde ses gelmiyor.

terminal ekranı çıkıyor uygulamada. ki bu şu an için gayet iyi ama ileride kapatmamız lazım **şu an kesinlikle kapatmıyoruz**.
şu yaptığım birkaç denemeden sonraki log dosyası: "0:00:00.176700200  2332 0000019F6DAD1CC0 FIXME                default gstutils.c:4090:gst_element_decorate_stream_id_internal:<wasapi2src0> Creating random stream-id, consider implementing a deterministic way of creating a stream-id
0:00:00.195583800  2332 0000019F6DAD1D40 FIXME                default gstutils.c:4090:gst_element_decorate_stream_id_internal:<dx9screencapsrc0> Creating random stream-id, consider implementing a deterministic way of creating a stream-id
"

bahsettiğim terminal ekranında da yyına başlayınca şu yazıyor: "1.0:10972): WARNING **: 18:58:02.721: "dx9screencapsrc" is deprecated and will be removedin the future. Use "d3d11screencapturesrc" element instead
Use Windows high-resolution clock, precision: 1 ms
Setting pipeline to PAUSED ...
Pipeline is live and does not need PREROLL ...
Pipeline is PREROLLED ...
Setting pipeline to PLAYING ...
Redistribute latency...
Redistribute latency...
New clock: GstAudioSrcClock
Redistribute latency...
Redistribute latency...
Redistribute latency...
0:00:07.6 / 99:99:99."

ses için ayarlara girdim oradan ses giriş cihazı 'system default' yazıyordu ona tıklaıdm ve 'device 0' seçtim sonra yayına girdim hata verdi log'u kontrol edin dedi
ben de log'a baktım bu yazıyordu: "0:00:00.203277000  2116 0000024CA2C94180 WARN           wasapi2client gstwasapi2client.cpp:1005:gst_wasapi2_client_activate_async:<wasapi2client0> Couldn't find target device
0:00:00.204186800  2116 0000024CA2D21180 WARN       wasapi2ringbuffer gstwasapi2ringbuffer.cpp:352:gst_wasapi2_ring_buffer_post_open_error:<wasapi2src0> error: Failed to open device
"
 

ada eskiden oldupu gibi yayına siyah bant olarak gidiyor, minik ada aslında o kadar mink olmadığı giden siyah bant sayesinde anlayabiliiyorum.
arka planda aslında bizim görmediğimiz kocaman bir dikdörtgen. Burada kocaman bir dikdörtgen olması sorunu yüzünden kullanıcı farkında olmadan,
adanın altındaki bir butona tıklamak istiyor mesela adanın altında chrome'da bir buton var ona tıklayacak ama tıklayamıyor çünkü orada kocaman,
görünmez bir dikdörtgen var. Bunu çözemeliyiz.
Tarayıcıdan bile yüklerken virüs olarak algılayıp ben 2 kez hayır sakla diyip açıyorum,
windows mavi ekranda kurulum aşamasında uyarıyor bak virüs olabilir diye.
micorosoft defender'ı kapattım öyle indirebildim bunlar da sorun üstüne tartışılması gereken.

şu an önceliğimiz tabii ufak arayüz detayları değil ama bunları yazmam lazım ki unutmayalım.

şu ana kadar bu hataları buldum.


daha sonra kendi bilgisayarımda denemek için termianlde şunu yazdım: "PS D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core> cd .\app\        
PS D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\app> npm run tauri dev           

> unicast@0.1.0 tauri
> tauri dev

     Running BeforeDevCommand (`npm run dev`)
     Running DevCommand (`cargo  run --no-default-features --color always --`)
        Info Watching D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\app\src-tauri for changes...

> unicast@0.1.0 dev
> vite

error when starting dev server:
Error: Port 5173 is already in use
    at Server.onError (file:///D:/Okul%20Belgeleri/4.%20S%C4%B1n%C4%B1f/Bitirme/yeni/core/app/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:45596:18)
    at Server.emit (node:events:524:28)
    at emitErrorNT (node:net:1973:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
       Error The "beforeDevCommand" terminated with a non-zero status code."

daha sonra fresh windwowstaki exe'yi kendi bilgisayarıma kurdum: sunum ekranına gelir gelmez bu uyarıyı verdi: "gst-plugin-scanner.exe - Giriş Noktası Bulunamadı
g_once_init_leave_pointer yordam giriş noktası, C:program
Filesigstreamerkl I - I ,û-û.dll dinamik
bağlantı kitaplığında bulunamadı,
Tamam
x", daha sonra tamam'a bastım sürekli bu uyarıyı vermeye devam etti. yayın bile başlatamadım.
bu da benim makinedeki log dosyası: "0:00:08.073172300  5920 0000014FAB9B69F0 WARN      GST_PLUGIN_LOADING gstplugin.c:883:_priv_gst_plugin_load_file_for_registry: module_open failed: Belirtilen yordam bulunamadı.
0:00:08.073725000  5920 0000014FAB9B69F0 WARN      GST_PLUGIN_LOADING gstpluginloader-win32.c:622:win32_plugin_loader_write_packet_async: Operation failed with 0xe8 (Boru kapatılıyor.)
"
