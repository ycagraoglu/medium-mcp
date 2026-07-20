# Medium MCP

Medium üzerinde oturum gerektiren makaleleri aramak ve okumak için geliştirilmiş, **yalnızca okuma yetkili** bir Model Context Protocol sunucusudur.

Bu ilk sürüm yerel bilgisayarda `stdio` transport ile çalışır. Medium oturumu Playwright üzerinden açılan gerçek Chrome penceresinde kullanıcı tarafından tamamlanır. Kimlik doğrulama bilgileri uygulama tarafından okunmaz veya saklanmaz; yalnızca oluşan Medium tarayıcı oturumu yerel `.data/medium-session.json` dosyasına kaydedilir.

## Sağlanan MCP araçları

- `medium_login_status`: Kaydedilmiş Medium oturumunun geçerli olup olmadığını kontrol eder.
- `medium_search`: Medium üzerinde anahtar kelimeyle makale arar.
- `medium_read_article`: Verilen `medium.com` adresindeki makaleyi açar ve temiz metin olarak döndürür.

## Desteklenen Medium giriş yöntemleri

Medium giriş ekranında şu ana seçenekler sunulur:

- Google
- Facebook
- Apple
- X
- E-posta

E-posta doğrulamasının magic link veya doğrulama kodu gibi ayrıntıları Medium'un e-posta akışı içinde yönetilir; bunlar ayrı bir üst seviye giriş yöntemi olarak modellenmez.

MCP hiçbir sağlayıcının kullanıcı adı, parolası, e-posta doğrulama bilgisi, magic linki veya 2FA bilgisini okumaz. Tüm doğrulama işlemleri kullanıcı tarafından açılan tarayıcı penceresinde tamamlanır.

## Gereksinimler

- Node.js 20 veya üzeri
- Google Chrome
- Medium hesabı

## Kurulum

```bash
npm install
npx playwright install chrome
npm run build
```

## İlk giriş

Tüm yöntemleri kullanıcıya bırakan genel giriş akışı:

```bash
npm run login
```

Belirli bir yöntem için yönlendirme mesajı göstermek isterseniz:

```bash
npm run login -- --method=email
npm run login -- --method=google
npm run login -- --method=apple
npm run login -- --method=facebook
npm run login -- --method=twitter
```

`--method` parametresi giriş bilgilerini otomatik doldurmaz. Yalnızca açılan tarayıcıda hangi akışın izleneceğini açıklar. Medium giriş ekranındaki gerçek işlem kullanıcı tarafından yapılır.

Başarılı girişten sonra oturum aşağıdaki dosyaya kaydedilir:

```text
.data/medium-session.json
```

Bu dosya aktif Medium oturumunu temsil edebilir. Git tarafından takip edilmez ve kesinlikle paylaşılmamalıdır.

## Sunucuyu çalıştırma

Geliştirme sırasında:

```bash
npm run dev
```

Derlenmiş sürüm:

```bash
npm run build
npm start
```

## MCP istemci yapılandırması

Derleme sonrasında MCP istemcinize aşağıdaki gibi ekleyebilirsiniz:

```json
{
  "mcpServers": {
    "medium": {
      "command": "node",
      "args": ["C:/Projects/medium-mcp/dist/src/index.js"],
      "cwd": "C:/Projects/medium-mcp"
    }
  }
}
```

Yolları kendi bilgisayarınızdaki proje konumuna göre değiştirin.

## Güvenlik yaklaşımı

- Sunucu yalnızca `https://medium.com` ve alt alan adlarını açar.
- Yazma, yayınlama veya silme aracı içermez.
- Giriş sağlayıcılarının kullanıcı adı, parola, e-posta doğrulama bilgisi, magic link veya 2FA bilgilerini istemez ve saklamaz.
- Oturum dosyası `.gitignore` ile dışlanmıştır.
- Tarayıcı güvenliğini devre dışı bırakan Chromium parametreleri kullanılmaz.
- Makale içeriği güvenilmeyen harici veri olarak işaretlenir; makale içindeki talimatlar MCP veya istemci tarafından komut olarak değerlendirilmemelidir.

## Mevcut kapsam

Bu sürüm yerel kullanım için hazırlanmıştır. ChatGPT gibi uzak istemcilere bağlanabilmesi için sonraki aşamada kimlik doğrulamalı Streamable HTTP transport ve güvenli sunucu dağıtımı eklenecektir.
