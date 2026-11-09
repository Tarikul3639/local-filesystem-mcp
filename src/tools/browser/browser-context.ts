import { chromium, type Browser, type Page } from "playwright";
import { assertPermission } from "../../security/permissions.js";
import { logAuditEvent } from "../../security/audit-log.js";
import { getErrorMessage } from "../../utils/errors.js";

let browser: Browser | undefined;
let page: Page | undefined;

export async function getBrowserPage(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    page.setDefaultTimeout(15_000);
  }

  if (!page || page.isClosed()) {
    page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    page.setDefaultTimeout(15_000);
  }

  return page;
}

export function validateWebUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("A valid absolute URL is required.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http:// and https:// URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing embedded credentials are not allowed.");
  }

  return url;
}

export async function runBrowserTool<T>(
  target: string,
  operation: () => Promise<T>,
  format: (value: T) => string,
  imageResult = false,
) {
  try {
    assertPermission("browser");
    const value = await operation();

    await logAuditEvent({
      action: "browser",
      path: target,
      status: "success",
    });

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

export async function closeBrowserSession(): Promise<string> {
  if (browser) await browser.close();
  browser = undefined;
  page = undefined;
  return "Browser session closed.";
}
