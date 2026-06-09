"use client";

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Sidebar';

function SignupPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/ropa';
  const error = searchParams?.get('error');

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading('email');
    await signIn('resend', { email, callbackUrl });
    setIsLoading(null);
  };

  const handleOAuthSignIn = async (provider: 'google' | 'microsoft-entra-id') => {
    setIsLoading(provider);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-bone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-sage-500/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <Logo className="mb-6 scale-110" />
        <h2 className="text-center text-3xl font-serif tracking-tight text-ink-900">
          Create your workspace
        </h2>
        <p className="mt-2 text-center text-[13.5px] text-ink-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-sage-600 hover:text-sage-700 transition-colors">
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="bg-white hairline py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3 bg-clay-50 border border-clay-100 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
              <div className="text-[13px] text-clay-700 leading-relaxed">
                An error occurred during sign up. Please try again or use a different method.
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleEmailSignIn}>
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-ink-700">
                Work email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-ink-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 hairline bg-bone-50 rounded-lg text-[13.5px] text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-sage-500/20 sm:text-sm transition-shadow"
                  placeholder="name@agency.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading !== null}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-card text-[13.5px] font-medium text-bone-50 bg-sage-700 hover:bg-sage-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500 disabled:opacity-50 transition-all"
              >
                {isLoading === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue with email'}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink-900/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-ink-500 text-[12.5px]">Or sign up with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading !== null}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 hairline bg-bone-50 hover:bg-bone-100 rounded-lg text-[13px] font-medium text-ink-700 transition-colors disabled:opacity-50"
              >
                {isLoading === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                    <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3276 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"/>
                    <path d="M5.50253 14.3003C5.00023 12.8099 5.00023 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC04"/>
                    <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"/>
                  </svg>
                )}
                Google
              </button>
              
              <button
                onClick={() => handleOAuthSignIn('microsoft-entra-id')}
                disabled={isLoading !== null}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 hairline bg-bone-50 hover:bg-bone-100 rounded-lg text-[13px] font-medium text-ink-700 transition-colors disabled:opacity-50"
              >
                {isLoading === 'microsoft-entra-id' ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                )}
                Microsoft
              </button>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[12px] text-ink-400 max-w-sm mx-auto leading-relaxed">
          By signing up, you agree to Privaro's{' '}
          <a href="#" className="underline hover:text-ink-600 transition-colors">Terms of Service</a> and{' '}
          <a href="#" className="underline hover:text-ink-600 transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone-50 flex justify-center py-12"><div className="text-ink-500">Loading...</div></div>}>
      <SignupPageContent />
    </Suspense>
  );
}
