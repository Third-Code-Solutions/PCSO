'use client';

import * as React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'senate-hris-theme';

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function DisplayTab() {
  const [theme, setTheme] = React.useState<Theme>('system');

  // Read from localStorage on mount (client-only)
  React.useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  function handleThemeChange(value: string) {
    const next = value as Theme;
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    toast.success('Theme updated', { description: `Switched to ${next} mode.` });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Display
        </CardTitle>
        <CardDescription>
          Customize the appearance of the application. Your preference is stored locally in your
          browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-xs space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme-select">Color Theme</Label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id="theme-select">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            "System" follows your operating system's dark/light mode preference.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
