"use client";

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/layout/MarketingHeader';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/ropa';
  const error = searchParams?.get('error');

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [domainData, setDomainData] = useState<{ sso: boolean, name?: string } | null>(null);

  const checkEmailDomain = async (emailToCheck: string) => {
    if (!emailToCheck.includes('@')) return;
    try {
      const res = await fetch(`/api/auth/check-domain?email=${encodeURIComponent(emailToCheck)}`);
      if (res.ok) {
        const data = await res.json();
        setDomainData(data);
      }
    } catch (e) {}
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (domainData?.sso) {
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/sso/login?email=${encodeURIComponent(email)}`;
      return;
    }
    setIsLoading('email');
    await signIn('resend', { email, callbackUrl });
    setIsLoading(null);
  };

  const handleOAuthSignIn = async (provider: 'google' | 'microsoft-entra-id') => {
    setIsLoading(provider);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-[#08090A] flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#C9A227]/30 relative overflow-hidden">
      {/* Background decorations matching marketing design */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-0 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none opacity-50" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center z-10">
        <Logo className="mb-8 scale-110 justify-center" />
        <h2 className="text-center text-[32px] font-normal tracking-[-0.032em] text-[#F4F5F6]">
          Sign in to your account
        </h2>
        <p className="mt-3 text-center text-[15px] text-[#9BA1A6]">
          Or{' '}
          <Link href="/signup" className="font-medium text-[#E6E8EA] hover:text-[#C9A227] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-sm px-1">
            create a new agency workspace
          </Link>
        </p>
      </div>

      <div className="relative mt-10 sm:mx-auto sm:w-full sm:max-w-[440px] z-10">
        <div className="bg-gradient-to-b from-[#0D0F11] to-[#0A0B0D] border border-white/9 py-10 px-6 shadow-panel-elevated sm:px-10">
          {error && (
            <div className="mb-8 p-4 bg-red-950/30 border border-red-900/50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-[14px] text-red-200/90 leading-relaxed">
                {error === 'OAuthAccountNotLinked' 
                  ? 'To confirm your identity, sign in with the same account you used originally.'
                  : 'An error occurred during authentication. Please try again.'}
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleEmailSignIn}>
            <div>
              <label htmlFor="email" className="block text-[14px] font-medium text-[#E6E8EA]">
                Email address
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-[#6E747A]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => checkEmailDomain(email)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-white/10 bg-[#040506] text-[15px] text-[#E6E8EA] placeholder-[#6E747A] focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 sm:text-sm transition-all"
                  placeholder="name@agency.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading !== null}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 text-[14px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#08090A] focus:ring-[#C9A227] disabled:opacity-50 transition-all"
              >
                {isLoading === 'email' ? <Loader2 className="w-4 h-4 animate-spin text-[#08090A]" /> : domainData?.sso ? `Sign in with SSO${domainData.name ? ` (${domainData.name})` : ''}` : 'Send magic link'}
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-[#0A0B0D] text-[#6E747A] text-[13px]">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading !== null}
                className="w-full flex justify-center items-center gap-2.5 py-3 px-4 border border-white/10 bg-transparent hover:bg-white/5 text-[14px] font-medium text-[#E6E8EA] transition-colors disabled:opacity-50 focus:outline-none focus:border-white/20"
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
                className="w-full flex justify-center items-center gap-2.5 py-3 px-4 border border-white/10 bg-transparent hover:bg-white/5 text-[14px] font-medium text-[#E6E8EA] transition-colors disabled:opacity-50 focus:outline-none focus:border-white/20"
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
        
        <p className="mt-10 text-center text-[13px] text-[#6E747A] max-w-sm mx-auto leading-relaxed z-10 relative">
          By signing in, you agree to Custodia's{' '}
          <a href="#" className="underline hover:text-[#9BA1A6] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-sm">Terms of Service</a> and{' '}
          <a href="#" className="underline hover:text-[#9BA1A6] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-sm">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08090A] flex justify-center py-12"><div className="text-[#9BA1A6]">Loading...</div></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
