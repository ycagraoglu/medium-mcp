const captureButton = document.getElementById("capture");
const statusElement = document.getElementById("status");

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = type;
}

function extractMediumArticle() {
  const article = document.querySelector("article");
  const title =
    article?.querySelector("h1")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title.replace(/\s*[|–-]\s*Medium.*$/i, "").trim();

  const author =
    document.querySelector('a[rel="author"]')?.textContent?.trim() ||
    article?.querySelector('a[href^="/@"]')?.textContent?.trim() ||
    undefined;

  const publishedAt =
    document.querySelector("article time")?.getAttribute("datetime") ||
    document.querySelector("time")?.getAttribute("datetime") ||
    undefined;

  const text = article?.innerText?.trim() || "";

  return {
    title,
    url: window.location.href.split("?")[0],
    author,
    publishedAt,
    text,
  };
}

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  setStatus("Makale okunuyor…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url?.startsWith("https://medium.com/")) {
      throw new Error("Önce Medium üzerinde bir makale açın.");
    }

    const [{ result: article }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMediumArticle,
    });

    if (!article?.text || article.text.length < 100) {
      throw new Error("Makale metni bulunamadı. Sayfanın tamamen açıldığından emin olun.");
    }

    const response = await fetch("http://127.0.0.1:3210/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || `Yerel sunucu ${response.status} hatası döndürdü.`);
    }

    setStatus(`Aktarıldı: ${payload.article.title}`, "success");
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "Yerel MCP sunucusuna ulaşılamadı. Önce npm run dev komutunu çalıştırın."
        : error?.message || "Makale aktarılamadı.";

    setStatus(message, "error");
  } finally {
    captureButton.disabled = false;
  }
});
