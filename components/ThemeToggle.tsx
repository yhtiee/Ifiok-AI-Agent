"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { applyChoice, effectiveTheme, storedChoice, subscribeTheme, type Theme, type ThemeChoice } from "@/lib/theme";

// The light/dark switch (12 §4 Q65): one button that flips what the page shows now, and the
// System · Light · Dark choice on Me. Both read the same store, so they stay in step.

const useTheme = () => useSyncExternalStore<Theme | null>(subscribeTheme, effectiveTheme, () => null);
const useChoice = () => useSyncExternalStore<ThemeChoice | null>(subscribeTheme, storedChoice, () => null);

/** A 44 px icon button. `className` styles it for where it sits (app sidebar, landing header). */
export function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = theme ? `Switch to ${next} mode` : "Switch between light and dark mode";
  return (
    <button
      type="button"
      aria-label={withLabel ? undefined : label}
      title={label}
      onClick={() => applyChoice(next)}
      className={className}
    >
      {theme === "dark" ? <SunIcon size={20} aria-hidden="true" /> : <MoonIcon size={20} aria-hidden="true" />}
      {withLabel ? <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Use my device setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** System · Light · Dark, for the Me page. */
export function ThemeChoices() {
  const choice = useChoice();
  return (
    <fieldset className="grid gap-1">
      <legend className="sr-only">Appearance</legend>
      {CHOICES.map((c) => (
        <label key={c.value} className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="radio"
            name="theme"
            value={c.value}
            checked={choice === c.value}
            onChange={() => applyChoice(c.value)}
            className="h-5 w-5 accent-[var(--quantity)]"
          />
          {c.label}
        </label>
      ))}
    </fieldset>
  );
}
