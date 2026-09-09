"use client";

import * as React from "react";

export type Theme = "light" | "dark";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children, defaultTheme = "light" }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("ownera_theme") as Theme | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(saved);
      } else {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(defaultTheme);
      }
    } catch {}
  }, [defaultTheme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem("ownera_theme", nextTheme);
    } catch {}
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => React.useContext(ThemeContext);
