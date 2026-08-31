/**
 * Client-facing job status — collapses the legacy 7-value requestStatus
 * (Active, Confirmed, Completed, Deleted by Client, Submissions Paused,
 * Lost - No Revenue, Pending Payment, plus null) into the 3 states a client
 * actually thinks in. Nothing in the DB is migrated — this is purely a
 * display/write lens over the existing requestStatus column, so every
 * legacy row maps cleanly with zero backfill.
 */
export type SimpleJobStatus = "Active" | "Paused" | "Archived";

export const SIMPLE_JOB_STATUSES: SimpleJobStatus[] = ["Active", "Paused", "Archived"];

const RAW_TO_SIMPLE: Record<string, SimpleJobStatus> = {
  "Active": "Active",
  "Submissions Paused": "Paused",
};

/** Anything not explicitly Active or Paused reads as Archived — Confirmed,
 *  Completed, Deleted by Client, Lost - No Revenue, Pending Payment, null,
 *  and the new literal "Archived" value all collapse here. */
export function toSimpleJobStatus(requestStatus: string | null | undefined): SimpleJobStatus {
  if (!requestStatus) return "Archived";
  return RAW_TO_SIMPLE[requestStatus] ?? "Archived";
}

/** The literal requestStatus value written when a client sets each simplified status. */
export const SIMPLE_STATUS_TO_RAW: Record<SimpleJobStatus, string> = {
  Active: "Active",
  Paused: "Submissions Paused",
  Archived: "Archived",
};
