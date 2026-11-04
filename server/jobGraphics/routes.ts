/** Admin-only, one-time step that connects the Artswrk Canva account to the server. */
import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { finishCanvaConnection, startCanvaConnection } from "./canva";

async function isAdmin(req: Request): Promise<boolean> {
  try {
    return (await sdk.authenticateRequest(req)).role === "admin";
  } catch {
    return false;
  }
}

export function registerCanvaRoutes(app: Express): void {
  app.get("/api/canva/connect", async (req: Request, res: Response) => {
    if (!(await isAdmin(req))) return void res.status(403).send("Admin only");
    res.redirect(await startCanvaConnection());
  });

  app.get("/api/canva/callback", async (req: Request, res: Response) => {
    if (!(await isAdmin(req))) return void res.status(403).send("Admin only");
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string") {
      return void res.status(400).send("Canva did not return an approval code.");
    }
    try {
      await finishCanvaConnection(code, state);
      res.send("Canva is connected. You can close this tab.");
    } catch (err) {
      console.error("[job-graphics] Canva connection failed:", (err as Error).message);
      res.status(400).send("Could not connect Canva. Please try again.");
    }
  });
}
