// Light and dark mode (07 §3, 12 §4 Q65). The tokens in app/globals.css already switch on
// <html data-theme="light|dark">, falling back to the device setting when there's no attribute.
// The choice lives in this browser only (localStorage), is applied before first paint by
// THEME_SCRIPT in the root layout (so no flash and the landing page stays static), and every
// switch on the page stays in step through a window event.

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "ifiok-theme";
const EVENT = "ifiok-theme";

/** Runs in <head> before the page paints. Kept tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export function storedChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** What the page shows right now: the saved choice, or the device setting. */
export function effectiveTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode or blocked storage: the switch still works for this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls back when the theme changes here, in another tab, or on the device (while following it). */
export function subscribeTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    const t = e.newValue;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", callback);
  };
}
