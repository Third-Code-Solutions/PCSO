'use client';

import * as React from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { changePassword } from './actions';

export function PasswordTab() {
  const [pending, setPending] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [form, setForm] = React.useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = React.useState<Partial<Record<keyof typeof form, string>>>({});

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const next: typeof errors = {};

    if (form.newPassword.length < 8) {
      next.newPassword = 'Password must be at least 8 characters.';
    }
    if (form.newPassword !== form.confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPending(true);
    try {
      await changePassword({
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      toast.success('Password updated successfully');
      setForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Password change failed', {
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Change Password
        </CardTitle>
        <CardDescription>
          Choose a strong password. It must be at least 8 characters long.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => updateField('newPassword', e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className={errors.newPassword ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                autoComplete="new-password"
                required
                className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="bg-senate-navy text-white hover:bg-senate-navy-light"
          >
            {pending ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
