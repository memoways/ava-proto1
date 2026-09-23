export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "ava_admin_theme";

export function readAdminTheme(storage: Pick<Storage, "getItem"> = window.localStorage): AdminTheme {
  try {
    return storage.getItem(ADMIN_THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveAdminTheme(
  theme: AdminTheme,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    storage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    // The toggle still works for the current visit when storage is unavailable.
  }
}