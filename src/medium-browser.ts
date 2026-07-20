import { existsSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { config } from "./config.js";

export interface MediumSearchResult {
  title: string;
  url: string;
  author: string | null;
  excerpt: string | null;
}

export interface MediumArticle {
  title: string;
  url: string;
  author: string | null;
  publishedAt: string | null;
  content: string;
}

export interface MediumLoginStatus {
  loggedIn: boolean;
  profileName: string | null;
}

export class MediumBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(): Promise<void> {
    if (!existsSync(config.sessionPath)) {
      throw new Error("Medium session not found. Run `npm run login` first.");
    }

    this.browser = await chromium.launch({
      headless: config.headless,
      channel: config.browserChannel
    });

    this.context = await this.browser.newContext({
      storageState: config.sessionPath,
      locale: "en-US"
    });
  }

  async getLoginStatus(): Promise<MediumLoginStatus> {
    const page = await this.newPage();

    try {
      await page.goto("https://medium.com/me/settings", {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs
      });

      const loggedIn = !page.url().includes("/m/signin");
      if (!loggedIn) {
        return { loggedIn: false, profileName: null };
      }

      const profileName = await page
        .locator("h1, h2, [data-testid='profile-name']")
        .first()
        .textContent()
        .catch(() => null);

      return {
        loggedIn: true,
        profileName: profileName?.trim() || null
      };
    } finally {
      await page.close();
    }
  }

  async search(query: string, limit: number): Promise<MediumSearchResult[]> {
    const normalizedLimit = Math.min(Math.max(limit, 1), config.maxSearchResults);
    const page = await this.newPage();

    try {
      await page.goto(`https://medium.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs
      });

      await page.waitForSelector("article", { timeout: 15_000 });

      const results = await page.locator("article").evaluateAll((articles, maxItems) => {
        const unique = new Map<string, MediumSearchResult>();

        for (const article of articles) {
          const links = Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]"));
          const storyLink = links.find(link => {
            try {
              const url = new URL(link.href);
              return url.hostname.endsWith("medium.com") && !url.pathname.startsWith("/tag/");
            } catch {
              return false;
            }
          });

          const title = article.querySelector("h2, h3")?.textContent?.trim();
          if (!storyLink || !title) continue;

          const cleanUrl = storyLink.href.split("?")[0];
          if (!cleanUrl || unique.has(cleanUrl)) continue;

          const author = article
            .querySelector("a[href*='/@'], [data-testid='authorName']")
            ?.textContent?.trim() || null;

          const paragraphs = Array.from(article.querySelectorAll("p"))
            .map(element => element.textContent?.trim())
            .filter((value): value is string => Boolean(value));

          unique.set(cleanUrl, {
            title,
            url: cleanUrl,
            author,
            excerpt: paragraphs.find(value => value !== author && value !== title) || null
          });

          if (unique.size >= maxItems) break;
        }

        return Array.from(unique.values());
      }, normalizedLimit);

      return results;
    } finally {
      await page.close();
    }
  }

  async readArticle(rawUrl: string): Promise<MediumArticle> {
    const url = this.validateMediumUrl(rawUrl);
    const page = await this.newPage();

    try {
      await page.goto(url.toString(), {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs
      });

      await page.waitForSelector("article", { timeout: 15_000 });

      const article = await page.locator("article").first().evaluate((element, maxCharacters) => {
        const title = element.querySelector("h1")?.textContent?.trim() || document.title;
        const author = element
          .querySelector("a[href*='/@'], [rel='author'], [data-testid='authorName']")
          ?.textContent?.trim() || null;
        const publishedAt = element.querySelector("time")?.getAttribute("datetime") ||
          element.querySelector("time")?.textContent?.trim() || null;

        const contentElements = Array.from(
          element.querySelectorAll("h2, h3, h4, p, blockquote, pre, li")
        );

        const content = contentElements
          .map(node => node.textContent?.trim())
          .filter((value): value is string => Boolean(value))
          .join("\n\n")
          .slice(0, maxCharacters);

        return { title, author, publishedAt, content };
      }, config.maxArticleCharacters);

      if (!article.content) {
        throw new Error("Article content could not be extracted.");
      }

      return {
        ...article,
        url: url.toString()
      };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
  }

  private async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error("Medium browser is not initialized.");
    }

    return this.context.newPage();
  }

  private validateMediumUrl(rawUrl: string): URL {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS Medium URLs are allowed.");
    }

    if (hostname !== "medium.com" && !hostname.endsWith(".medium.com")) {
      throw new Error("Only medium.com URLs are allowed.");
    }

    url.hash = "";
    return url;
  }
}
