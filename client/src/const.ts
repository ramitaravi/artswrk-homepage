export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// getLoginUrl() lived here and built a URL to the external Manus OAuth portal.
// Every caller sent users to a manus.im-branded sign-in page mid-signup, so all
// of them now point at Artswrk's own /login and /join instead. Deliberately not
// kept as a fallback — leaving it available is how it crept back into six call
// sites the first time.
