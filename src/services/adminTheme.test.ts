import { describe, expect, it, vi } from "vitest";
import { ADMIN_THEME_STORAGE_KEY, readAdminTheme, saveAdminTheme } from "@/services/adminTheme";

describe("adminTheme", () => {
  it("defaults safely to dark", () => {
    expect(readAdminTheme({ getItem: () => null })).toBe("dark");
    expect(readAdminTheme({ getItem: () => "unexpected" })).toBe("dark");
  });

  it("restores a saved light preference", () => {
    expect(readAdminTheme({ getItem: () => "light" })).toBe("light");
  });

  it("stores the preference under an admin-only key", () => {
    const setItem = vi.fn();
    saveAdminTheme("light", { setItem });
    expect(setItem).toHaveBeenCalledWith(ADMIN_THEME_STORAGE_KEY, "light");
  });

  it("falls back without failing when browser storage is blocked", () => {
    expect(readAdminTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("dark");
    expect(() => saveAdminTheme("light", { setItem: () => { throw new Error("blocked"); } })).not.toThrow();
  });
});