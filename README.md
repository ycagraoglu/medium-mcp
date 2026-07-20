# Medium MCP

Medium makalelerini kullanıcının **normal Edge/Chrome oturumu** üzerinden yerel MCP sunucusuna aktarır. Google ile giriş, şifre, doğrulama kodu ve cookie kopyalama işlemleri bu proje tarafından yönetilmez.

## Nasıl çalışır?

1. Kullanıcı normal Edge tarayıcısında Medium'a Google hesabıyla giriş yapar.
2. Medium makalesini açar.
3. `Medium MCP Capture` eklentisindeki **Bu makaleyi aktar** düğmesine basar.
4. Makale yerel sunucuya gönderilir.
5. MCP istemcisi `list_medium_articles` ve `read_medium_article` araçlarıyla içeriğe erişir.

## Kurulum

```cmd
git checkout feature/browser-extension-ingest
npm install
npm run build
npm run dev
```

Sunucu çalıştığında terminalde şu adres görünür:

```text
http://127.0.0.1:3210
```

Sağlık kontrolü:

```text
http://127.0.0.1:3210/health
```

## Edge eklentisini yükleme

1. Edge'de `edge://extensions` adresini açın.
2. Sol menüden **Geliştirici modu** seçeneğini açın.
3. **Paketlenmemiş öğe yükle** düğmesine basın.
4. Bu repodaki `browser-extension` klasörünü seçin.
5. Normal Edge pencerenizde Medium'a Google hesabıyla giriş yapın.
6. Bir Medium makalesi açın.
7. Araç çubuğundaki Medium MCP eklentisine tıklayıp **Bu makaleyi aktar** düğmesine basın.

## MCP araçları

### `list_medium_articles`

Bu çalışma süresinde tarayıcıdan aktarılmış makaleleri listeler.

### `read_medium_article`

`id` verilirse ilgili makaleyi, verilmezse en son aktarılan makaleyi döndürür.

## Önemli not

İlk sürüm makaleleri yalnızca bellekte tutar. Sunucu kapatıldığında liste temizlenir. Kalıcı SQLite depolama sonraki adımda eklenebilir.
