import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first for immediate theme application
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark'; // Default to dark
  });

  // Sync theme from user profile when it loads
  useEffect(() => {
    if (profile?.theme_preference) {
      setThemeState(profile.theme_preference as Theme);
      localStorage.setItem('theme', profile.theme_preference);
    }
  }, [profile?.theme_preference]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  async function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    // Persist to database if user is logged in
    if (user) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ theme_preference: newTheme })
          .eq('id', user.id);

        if (error) {
          console.error('Error saving theme preference:', error);
        }
      } catch (err) {
        console.error('Exception saving theme preference:', err);
      }
    }
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
