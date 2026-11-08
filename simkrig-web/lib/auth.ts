const AUTH_EMAIL_DOMAIN = "login.sim-krig.invalid";
const USERNAME_PATTERN = /^[a-z0-9_]{3,64}$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}

export function usernameToAuthEmail(username: string) {
  const normalizedUsername = normalizeUsername(username);
  return normalizedUsername === "admin"
    ? "albertopintom@gmail.com"
    : `${normalizedUsername}@${AUTH_EMAIL_DOMAIN}`;
}
