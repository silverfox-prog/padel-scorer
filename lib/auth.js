const EDITOR_PASSWORD = process.env.NEXT_PUBLIC_EDITOR_PASSWORD;

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("padel_unlocked") === "true";
}

export function tryUnlock(password) {
  if (!EDITOR_PASSWORD || password === EDITOR_PASSWORD) {
    sessionStorage.setItem("padel_unlocked", "true");
    return true;
  }
  return false;
}

/**
 * Prompts the user for the editor password if not already unlocked this session.
 * Returns true if the caller may proceed with the write action, false otherwise.
 */
export function requireUnlock() {
  if (isUnlocked()) return true;
  const input = prompt("Enter the editor password to make changes:");
  if (input === null) return false; // user cancelled
  const ok = tryUnlock(input);
  if (!ok) alert("Incorrect password.");
  return ok;
}
