import type { Request } from "express";
import { ForbiddenError } from "@shared/_core/errors";
import { sdk, type AuthenticatedUser } from "./sdk";

/** Authenticate a Manus Heartbeat callback and return its trusted task uid. */
export async function requireCronRequest(req: Request): Promise<AuthenticatedUser & { taskUid: string; isCron: true }> {
  const user = await sdk.authenticateRequest(req);
  if (!user.isCron || !user.taskUid) throw ForbiddenError("Cron-only endpoint");
  return user as AuthenticatedUser & { taskUid: string; isCron: true };
}
