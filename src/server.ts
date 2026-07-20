import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface MediumArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  text: string;
  capturedAt: string;
}

const articles = new Map<string, MediumArticle>();
const app = express();
const port = Number(process.env.MEDIUM_MCP_PORT ?? 3210);

app.use(express.json({ limit: "5mb" }));

app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

app.options("*", (_request, response) => response.sendStatus(204));

app.get("/health", (_request: Request, response: Response) => {
  response.json({ ok: true, articleCount: articles.size });
});

app.post("/articles", (request: Request, response: Response) => {
  const { title, url, author, publishedAt, text } = request.body ?? {};

  if (typeof title !== "string" || title.trim().length === 0) {
    response.status(400).json({ ok: false, message: "title is required" });
    return;
  }

  if (typeof url !== "string" || !url.startsWith("https://medium.com/")) {
    response.status(400).json({ ok: false, message: "A valid Medium URL is required" });
    return;
  }

  if (typeof text !== "string" || text.trim().length < 100) {
    response.status(400).json({ ok: false, message: "Article text is missing or too short" });
    return;
  }

  const article: MediumArticle = {
    id: randomUUID(),
    title: title.trim(),
    url,
    author: typeof author === "string" ? author.trim() : undefined,
    publishedAt: typeof publishedAt === "string" ? publishedAt : undefined,
    text: text.trim(),
    capturedAt: new Date().toISOString(),
  };

  articles.set(article.id, article);
  response.status(201).json({ ok: true, article });
});

app.get("/articles", (_request: Request, response: Response) => {
  response.json({
    ok: true,
    articles: [...articles.values()].map(({ text, ...article }) => ({
      ...article,
      excerpt: text.slice(0, 240),
    })),
  });
});

app.listen(port, "127.0.0.1", () => {
  console.error(`Medium MCP bridge listening on http://127.0.0.1:${port}`);
});

const mcpServer = new Server(
  { name: "medium-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_medium_articles",
      description: "List Medium articles captured from the user's normal browser session.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "read_medium_article",
      description: "Read a captured Medium article by id. If id is omitted, returns the newest article.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
      },
    },
  ],
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "list_medium_articles") {
    const result = [...articles.values()].map(({ text, ...article }) => ({
      ...article,
      excerpt: text.slice(0, 240),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (request.params.name === "read_medium_article") {
    const requestedId = request.params.arguments?.id;
    const article =
      typeof requestedId === "string"
        ? articles.get(requestedId)
        : [...articles.values()].at(-1);

    if (!article) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "No Medium article has been captured yet. Open an article in Edge and use the Medium MCP extension.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `# ${article.title}\n\nURL: ${article.url}\nAuthor: ${article.author ?? "Unknown"}\nCaptured: ${article.capturedAt}\n\n${article.text}`,
        },
      ],
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
  };
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
