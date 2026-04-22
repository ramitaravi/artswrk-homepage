export const COOKIE_NAME = "app_session_id";
export const ADMIN_SESSION_COOKIE_NAME = "admin_session_backup";
// Non-httpOnly marker cookie readable by JS — signals that impersonation is active
export const IMPERSONATION_MARKER_COOKIE = "artswrk_impersonating";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
