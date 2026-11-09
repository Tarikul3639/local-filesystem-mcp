import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { chromium, type Browser, type Page } from "playwright";
import { assertPermission } from "../../security/permissions.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { getErrorMessage } from "../../utils/errors.js";

let browser: Browser | undefined;
let page: Page | undefined;

async function getPage(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15_000);
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15_000);
  }
  return page;
}

function validateWebUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("A valid absolute URL is required.");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only http:// and https:// URLs are allowed.");
  if (url.username || url.password)
    throw new Error("URLs containing embedded credentials are not allowed.");
  return url;
}

async function runTool<T>(
  target: string,
  operation: () => Promise<T>,
  format: (value: T) => string,
  imageResult = false,
) {
  try {
    assertPermission("browser");
    const value = await operation();
    await logAuditEvent({ action: "browser", path: target, status: "success" });
    if (imageResult && Buffer.isBuffer(value)) {
      return {
        content: [
          { type: "text" as const, text: "Browser screenshot captured." },
          {
            type: "image" as const,
            data: value.toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    }
    return { content: [{ type: "text" as const, text: format(value) }] };
  } catch (error) {
    await logAuditEvent({
      action: "browser",
      path: target,
      status: "failure",
    }).catch(() => undefined);
    return {
      content: [{ type: "text" as const, text: getErrorMessage(error) }],
      isError: true,
    };
  }
}

export function registerBrowserTools(server: McpServer): void {
  server.registerTool(
    "browser_navigate",
    {
      description:
        "Open an HTTP or HTTPS webpage in the persistent headless Chromium browser.",
      inputSchema: z.object({
        url: z.string().url(),
        waitUntil: z
          .enum(["load", "domcontentloaded", "networkidle", "commit"])
          .default("domcontentloaded"),
      }),
    },
    async ({ url, waitUntil }) =>
      runTool(
        url,
        async () => {
          const target = validateWebUrl(url);
          const currentPage = await getPage();
          await currentPage.goto(target.toString(), {
            waitUntil,
            timeout: 30_000,
          });
          return { title: await currentPage.title(), url: currentPage.url() };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );

  server.registerTool(
    "browser_click",
    {
      description:
        "Click the first element matching a CSS selector on the current webpage.",
      inputSchema: z.object({ selector: z.string().min(1).max(1000) }),
    },
    async ({ selector }) =>
      runTool(
        `click:${selector}`,
        async () => {
          const currentPage = await getPage();
          await currentPage.locator(selector).first().click();
          return {
            clicked: selector,
            url: currentPage.url(),
            title: await currentPage.title(),
          };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );

  server.registerTool(
    "browser_type",
    {
      description:
        "Fill a form field matching a CSS selector on the current webpage.",
      inputSchema: z.object({
        selector: z.string().min(1).max(1000),
        text: z.string().max(20_000),
      }),
    },
    async ({ selector, text }) =>
      runTool(
        `type:${selector}`,
        async () => {
          const currentPage = await getPage();
          await currentPage.locator(selector).first().fill(text);
          return { filled: selector, characters: text.length };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );

  server.registerTool(
    "browser_screenshot",
    {
      description: "Capture the current browser viewport as a PNG image.",
      inputSchema: z.object({ fullPage: z.boolean().default(false) }),
    },
    async ({ fullPage }) =>
      runTool(
        "screenshot",
        async () => {
          const currentPage = await getPage();
          return Buffer.from(
            await currentPage.screenshot({ fullPage, type: "png" }),
          );
        },
        () => "Screenshot captured.",
        true,
      ),
  );

  server.registerTool(
    "browser_get_text",
    {
      description: "Extract visible text from the current webpage.",
      inputSchema: z.object({
        selector: z.string().min(1).max(1000).default("body"),
        maxCharacters: z.number().int().min(1).max(50_000).default(15_000),
      }),
    },
    async ({ selector, maxCharacters }) =>
      runTool(
        `text:${selector}`,
        async () => {
          const currentPage = await getPage();
          return (
            await currentPage.locator(selector).first().innerText()
          ).slice(0, maxCharacters);
        },
        (result) => result,
      ),
  );

  server.registerTool(
    "browser_get_links",
    {
      description:
        "List links from the current webpage with visible text and absolute URLs.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ limit }) =>
      runTool(
        "links",
        async () => {
          const currentPage = await getPage();
          return currentPage.locator("a[href]").evaluateAll(
            (anchors: Element[], max: number) =>
              anchors.slice(0, max).map((anchor: Element) => ({
                text: (anchor.textContent ?? "")
                  .trim()
                  .replace(/\\s+/g, " ")
                  .slice(0, 300),
                url: (anchor as HTMLAnchorElement).href,
              })),
            limit,
          );
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );

  server.registerTool(
    "browser_go_back",
    {
      description: "Navigate to the previous page in the current browser tab.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(
        "history:back",
        async () => {
          const currentPage = await getPage();
          await currentPage
            .goBack({ waitUntil: "domcontentloaded", timeout: 15_000 })
            .catch(() => null);
          return { url: currentPage.url(), title: await currentPage.title() };
        },
        (result) => JSON.stringify(result, null, 2),
      ),
  );

  server.registerTool(
    "browser_close",
    {
      description: "Close the current Chromium browser session.",
      inputSchema: z.object({}),
    },
    async () =>
      runTool(
        "session:close",
        async () => {
          if (browser) await browser.close();
          browser = undefined;
          page = undefined;
          return "Browser session closed.";
        },
        (result) => result,
      ),
  );
}
