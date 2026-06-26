export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Google OAuth sign-in — redirects to /api/oauth/google on the same server,
// which then redirects to accounts.google.com. No manus.im URLs.
export const getLoginUrl = () => {
  return `${window.location.origin}/api/oauth/google`;
};
