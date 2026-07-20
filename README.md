# Medium MCP

Kişisel Medium oturumunuz üzerinden Medium makalelerini okumak için hazırlanmış, yerel ve salt-okunur bir MCP sunucusudur.

Bu proje:

- MCP istemcileriyle `stdio` üzerinden çalışır.
- Ayrı bir React uygulaması veya tarayıcı eklentisi kullanmaz.
- Playwright ile projeye özel kalıcı bir Edge profili açar.
- Google girişini desteklemez; Medium'un e-posta ile giriş akışı kullanılmalıdır.
- Oturumu `.data/medium-profile` klasöründe yerel olarak saklar.
- Makale içeriğini Markdown olarak MCP istemcisine döndürür.

## Gereksinimler

- Node.js 20 veya üzeri
- Microsoft Edge
- Medium hesabı

## Kurulum

```powershell
git clone https://github.com/ycagraoglu/medium-mcp.git
cd medium-mcp
npm install
npm run build
```

Playwright, varsayılan olarak bilgisayarınızda kurulu Microsoft Edge'i `msedge` kanalıyla kullanır. Ayrı Chromium indirmek gerekmez.

## İlk Medium girişi

```powershell
npm run login
```

Açılan pencerede:

1. Google ile giriş seçeneğini kullanmayın.
2. Medium'un e-posta ile giriş seçeneğini seçin.
3. Giriş işlemini tamamlayın.
4. Terminale dönüp ENTER'a basın.

Oturum şu klasörde saklanır:

```text
.data/medium-profile
```

Bu klasör Git'e gönderilmez. Hesap oturumunu sıfırlamak için Edge ve MCP süreçlerini kapattıktan sonra klasörü silebilirsiniz.

## MCP istemcisi yapılandırması

Windows yollarında `/` kullanmak JSON kaçış sorunlarını önler:

```json
{
  "mcpServers": {
    "medium-mcp": {
      "command": "node",
      "args": [
        "C:/Users/ycagr/Music/repos/medium-mcp/dist/index.js"
      ],
      "cwd": "C:/Users/ycagr/Music/repos/medium-mcp"
    }
  }
}
```

Önce `npm run build` çalıştırılmış olmalıdır.

## MCP araçları

### `login_to_medium`

Medium giriş sayfasını kalıcı tarayıcı profilinde açar. İnteraktif ilk kurulum için terminaldeki `npm run login` komutu daha uygundur.

### `check_medium_session`

Yerel tarayıcı profilindeki Medium oturumunun açık görünüp görünmediğini kontrol eder.

### `get_medium_article`

Bir Medium URL'sini açar, makaleyi mevcut oturumla okur ve Markdown döndürür.

Örnek istek:

```text
Bu Medium makalesini oku ve Türkçe özetle:
https://medium.com/...
```

### `search_medium`

Medium üzerinde metin araması yapar ve sonuçların başlık, URL, yazar ve kısa açıklamalarını döndürür.

## Ortam değişkenleri

Varsayılan Edge yerine Playwright Chromium kullanmak için:

```powershell
$env:MEDIUM_BROWSER_CHANNEL="chromium"
```

Arka planda çalıştırmayı denemek için:

```powershell
$env:MEDIUM_HEADLESS="true"
```

İlk giriş ve sorun giderme sırasında görünür tarayıcı önerilir.

## Güvenlik ve sınırlar

- Proje şifre toplamaz veya dış sunucuya göndermez.
- Medium oturumu yalnızca yerel tarayıcı profilinde tutulur.
- Yalnızca `https://medium.com` ve Medium alt alan adları kabul edilir.
- Medium arayüzü değişirse DOM seçicilerinin güncellenmesi gerekebilir.
- Erişim yetkisi olmayan üye içeriklerinin kilidini açmaz; yalnızca hesabınızın görüntüleyebildiği içeriği okur.
