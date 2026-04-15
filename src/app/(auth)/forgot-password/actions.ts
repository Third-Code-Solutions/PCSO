'use server';

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

export interface ForgotPasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Server action: send a password-reset email.
 *
 * Always returns `{ success: true }` to prevent email enumeration.
 * The reset link redirects to `/api/auth/callback?next=/reset-password`.
 */
export async function sendPasswordReset(input: unknown): Promise<ForgotPasswordResult> {
  const parsed = ForgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
  }

  const { email } = parsed.data;
  const supabase = await createServerClient();

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=/reset-password`;

  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Always report success to avoid user enumeration.
  return { success: true };
}
