# Medium MCP

Medium üzerinde oturum gerektiren makaleleri aramak ve okumak için geliştirilmiş, **yalnızca okuma yetkili** bir Model Context Protocol sunucusudur.

Bu ilk sürüm yerel bilgisayarda `stdio` transport ile çalışır. Medium oturumu Playwright üzerinden açılan gerçek Chrome penceresinde kullanıcı tarafından tamamlanır. Google şifresi uygulama tarafından okunmaz veya saklanmaz; yalnızca oluşan Medium tarayıcı oturumu yerel `.data/medium-session.json` dosyasına kaydedilir.

## Sağlanan MCP araçları

- `medium_login_status`: Kaydedilmiş Medium oturumunun geçerli olup olmadığını kontrol eder.
- `medium_search`: Medium üzerinde anahtar kelimeyle makale arar.
- `medium_read_article`: Verilen `medium.com` adresindeki makaleyi açar ve temiz metin olarak döndürür.

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

```bash
npm run login
```

Açılan Chrome penceresinde Medium girişini tamamlayın. Google ile giriş ve iki aşamalı doğrulama işlemleri kullanıcı tarafından tarayıcı içinde yapılır.

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
- Google kullanıcı adı ve şifresini istemez veya saklamaz.
- Oturum dosyası `.gitignore` ile dışlanmıştır.
- Tarayıcı güvenliğini devre dışı bırakan Chromium parametreleri kullanılmaz.
- Makale içeriği güvenilmeyen harici veri olarak işaretlenir; makale içindeki talimatlar MCP veya istemci tarafından komut olarak değerlendirilmemelidir.

## Mevcut kapsam

Bu sürüm yerel kullanım için hazırlanmıştır. ChatGPT gibi uzak istemcilere bağlanabilmesi için sonraki aşamada kimlik doğrulamalı Streamable HTTP transport ve güvenli sunucu dağıtımı eklenecektir.
