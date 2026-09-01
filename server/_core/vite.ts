import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { pathnameFromUrl, statusForPath } from "../redirects";
import { getRouteMeta, injectRouteMeta } from "../seoMeta";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const rendered = await vite.transformIndexHtml(url, template);
      // Same per-route SEO/OG injection as production, so what's verified in
      // dev is what ships.
      const page = injectRouteMeta(rendered, pathnameFromUrl(url));
      // Unknown routes get a real 404 status, not a 200 with the NotFound
      // component painted over it — a soft 404 tells crawlers the junk URL is
      // a real page and makes crawl audits unusable. Same HTML either way.
      res.status(statusForPath(pathnameFromUrl(url))).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const pathname = pathnameFromUrl(req.originalUrl);
    // See the note in setupVite: real 404 status for routes that don't exist.
    const status = statusForPath(pathname);

    // Landing pages get their own title/OG tags injected here. Setting them
    // from React would be too late — crawlers, iMessage and Slack read the raw
    // HTML and never run the SPA's JS, so every shared link would otherwise
    // carry the homepage card.
    const meta = getRouteMeta(pathname);
    if (meta) {
      try {
        const html = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
        res.status(status).set({ "Content-Type": "text/html" }).send(injectRouteMeta(html, pathname));
        return;
      } catch (err) {
        console.error("[seo] Failed to inject meta, serving default index.html:", err);
      }
    }
    res.status(status).sendFile(path.resolve(distPath, "index.html"));
  });
}
