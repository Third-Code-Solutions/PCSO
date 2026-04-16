import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { getSystemSettings } from './actions';
import { SettingsForm } from './_client';

export const metadata: Metadata = { title: 'System Settings — Admin' };

export default async function SettingsPage() {
  await requirePermission('admin', 'view');
  const initial = await getSystemSettings();

  return <SettingsForm initial={initial} />;
}
