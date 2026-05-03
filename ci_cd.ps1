# remove_and_recreate_tag.ps1
# Bu script v0.1.0 tag'ini siler, remote'dan kaldırır, yeniden oluşturur ve push eder.

# Çalışma dizinine geç
Set-Location "D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core"

# Eski tag'i sil
git tag -d v0.1.0

# Remote'dan sil
git push origin --delete v0.1.0

# Yeni tag oluştur
git tag v0.1.0

# Remote'a push et
git push origin v0.1.0
