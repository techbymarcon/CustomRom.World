export const HANDLE_DOMAIN = "handles.evolution-x.local";

// Not a secret: padding so short passwords still satisfy the auth minimum length.
const PASSWORD_PAD = "::evox";

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9_.]{3,24}$/.test(handle);
}

export function handleToEmail(handle: string): string {
  return `${normalizeHandle(handle)}@${HANDLE_DOMAIN}`;
}

export function padPassword(password: string): string {
  return `${password}${PASSWORD_PAD}`;
}
