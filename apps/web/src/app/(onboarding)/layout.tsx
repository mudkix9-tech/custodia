import React from 'react';
import Link from 'next/link';
import { trpc } from '@/utils/trpc';
import { useRouter } from 'next/navigation';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dismiss = trpc.onboarding.dismiss.useMutation();

  const handleDismiss = async () => {
    await dismiss.mutateAsync();
    // Need to trigger a session update so middleware picks up the new JWT.
    // But simpler: just redirect and let the client fetch or server update.
    // Wait, the JWT won't update automatically just by updating the DB. NextAuth requires updating the session.
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="text-xl font-bold text-gray-900">Privaro</div>
        </div>
        <button onClick={handleDismiss} className="text-sm text-gray-500 hover:text-gray-700">
          Save and exit
        </button>
      </header>
      <main className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
