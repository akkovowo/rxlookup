const ADMIN_LOGINS = new Set(["estk", "admin"]);

export function normalizeLogin(login: string) {
  return login.trim().toLowerCase().replace(/\s+/g, ".");
}

export function isAdminLogin(login: string) {
  return ADMIN_LOGINS.has(normalizeLogin(login));
}
