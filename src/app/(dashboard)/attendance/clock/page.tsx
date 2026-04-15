import { getCurrentUser } from '@/lib/auth/get-current-user';
import { redirect } from 'next/navigation';
import { ClockWidget } from './clock-widget';

export const metadata = { title: 'Web Time Clock' };

/**
 * Server component — resolves the current user's employeeId from the session
 * and passes it to the client-side ClockWidget.
 */
export default async function ClockPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!user.employeeId) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-[#0B2545]/10 bg-white p-8 text-center shadow-md">
          <p className="text-sm text-gray-500">
            Your account is not linked to an employee record. Contact HR to resolve this.
          </p>
        </div>
      </main>
    );
  }

  return <ClockWidget employeeId={user.employeeId} />;
}
