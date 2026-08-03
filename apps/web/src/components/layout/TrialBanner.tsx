"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function TrialBanner() {
  const { data: session } = useSession();
  const t = useTranslations("common");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !session) return null;

  const subscriptionStatus = (session as any)?.subscriptionStatus;
  const trialEndsAt = (session as any)?.trialEndsAt;

  if (subscriptionStatus !== "trialing" || !trialEndsAt) {
    return null;
  }

  const now = Date.now();
  const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 1) {
    return null; // Middleware handles the redirect for expired trials
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-center gap-3 text-amber-500 text-sm font-medium z-40">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{t("trialBanner.message", { count: daysLeft })}</span>
      <Link 
        href="/settings/billing" 
        className="ml-2 underline underline-offset-2 hover:text-amber-400 transition-colors"
      >
        {t("trialBanner.upgrade")}
      </Link>
    </div>
  );
}
