"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";

export function TrialBanner() {
  const { data: session } = useSession();
  const t = useTranslations("common");
  const [isClient, setIsClient] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const dismissedAt = localStorage.getItem('trialBannerDismissedAt');
    if (dismissedAt === new Date().toDateString()) {
      setIsDismissed(true);
    }
  }, []);

  if (!isClient || !session) return null;

  const subscriptionStatus = (session as any)?.subscriptionStatus;
  const trialEndsAt = (session as any)?.trialEndsAt;

  if (subscriptionStatus !== "trialing" || !trialEndsAt || isDismissed) {
    return null;
  }

  const now = Date.now();
  const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 1) {
    return null; // Middleware handles the redirect for expired trials
  }

  const handleDismiss = () => {
    localStorage.setItem('trialBannerDismissedAt', new Date().toDateString());
    setIsDismissed(true);
  };

  return (
    <div className="relative bg-amber-500/10 border-b border-amber-500/20 px-10 py-2.5 flex items-center justify-center gap-3 text-amber-500 text-sm font-medium z-40 group">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{t("trialBanner.message", { count: daysLeft })}</span>
      <Link 
        href="/settings/billing" 
        className="ml-2 underline underline-offset-2 hover:text-amber-400 transition-colors"
      >
        {t("trialBanner.upgrade")}
      </Link>
      <button 
        onClick={handleDismiss}
        className="absolute right-4 text-amber-500/50 hover:text-amber-500 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
