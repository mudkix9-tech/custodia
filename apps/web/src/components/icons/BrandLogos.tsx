import React from 'react';

interface LogoProps {
  className?: string;
}

export function HubSpotLogo({ className = "w-5 h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-square text-[#FF7A59] fill-current`} aria-hidden="true">
      <title>HubSpot Integration Logo</title>
      <path d="M21.4 9.3c-.6 0-1.1-.3-1.4-.7l-2.2 1.3c.1.3.2.7.2 1.1 0 1.7-1.4 3-3 3-1.2 0-2.2-.7-2.7-1.7L6.8 15.6c.1.3.2.7.2 1.1 0 1.7-1.4 3-3 3s-3-1.3-3-3 1.3-3 3-3c.5 0 .9.1 1.3.3l3.9-2.3c-.3-.5-.4-1.1-.4-1.7 0-1.7 1.4-3 3-3 .6 0 1.1.2 1.6.5l2.2-1.3c-.1-.3-.2-.7-.2-1.1 0-1.7 1.4-3 3-3s3 1.3 3 3-1.3 3-3 3zm-9.2 1.7c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z" />
    </svg>
  );
}

export function MailchimpLogo({ className = "w-5 h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-square text-[#FFE01B] fill-current`} aria-hidden="true">
      <title>Mailchimp Integration Logo</title>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.2 13.9c0 .773-.627 1.4-1.4 1.4s-1.4-.627-1.4-1.4.627-1.4 1.4-1.4 1.4.627 1.4 1.4zm-1.4-4c-.994 0-1.8-.806-1.8-1.8s.806-1.8 1.8-1.8 1.8.806 1.8 1.8-.806 1.8-1.8 1.8z" />
    </svg>
  );
}

export function GA4Logo({ className = "w-5 h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-square text-[#F9AB00] fill-current`} aria-hidden="true">
      <title>Google Analytics 4 Integration Logo</title>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2V9h2v8zm4 0h-2V7h2v10z" />
    </svg>
  );
}

export function StripeLogo({ className = "w-10 h-4.5" }: LogoProps) {
  return (
    <svg viewBox="0 0 40 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-[40/18] text-[#635BFF] fill-current`} aria-hidden="true">
      <title>Stripe Integration Logo</title>
      <path d="M13.9 6.8c0-1.1.9-1.8 2.4-1.8 1.4 0 2.5.5 3 .9l.8-2c-.8-.5-2.2-1-3.9-1-3.2 0-5.3 1.8-5.3 4.9 0 4.8 6.5 4 6.5 6.8 0 1.3-1.1 2-2.8 2-1.7 0-3.1-.6-3.8-1.1l-.8 2.1c1 .7 2.8 1.2 4.7 1.2 3.4 0 5.8-1.7 5.8-5 0-5.1-6.6-4.2-6.6-7zm-9.3-.9V3.5L1.4 4.2v2.2L4.6 5.9zm0 2.2H1.4v10.9h3.2V8.1zm15.3 0h-3.2v10.9h3.2V8.1zm-8.8 3.5c-.7 0-1.2.5-1.2 1.3 0 .8.5 1.3 1.2 1.3.7 0 1.2-.5 1.2-1.3 0-.8-.5-1.3-1.2-1.3zm0-3.5c-2.3 0-4 1.7-4 4.5s1.7 4.5 4 4.5c2.3 0 4-1.7 4-4.5s-1.7-4.5-4-4.5z" />
    </svg>
  );
}

export function SlackLogo({ className = "w-5 h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-square shrink-0`} aria-hidden="true">
      <title>Slack Integration Logo</title>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042z" fill="#36C5F0"/>
      <path d="M8.823 5.043a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.52-2.522V8.824a2.528 2.528 0 0 1 2.52-2.52h5.043z" fill="#2EB67D"/>
      <path d="M18.878 8.824a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.261 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.78a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043z" fill="#ECB22E"/>
      <path d="M15.097 18.878a2.528 2.528 0 0 1-2.52 2.52 2.528 2.528 0 0 1-2.522-2.52v-2.52h2.522a2.528 2.528 0 0 1 2.52 2.52zm0-1.261a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.52-2.522h5.043a2.528 2.528 0 0 1 2.52 2.522v5.043a2.528 2.528 0 0 1-2.52 2.52h-5.043z" fill="#E01E5A"/>
    </svg>
  );
}

export function SalesforceLogo({ className = "w-7 h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-[32/22] text-[#00A1E0] fill-current`} aria-hidden="true">
      <title>Salesforce Integration Logo</title>
      <path d="M25.75 10c0-2.76-2.24-5-5-5-1.5 0-2.85.66-3.79 1.71C16.24 6.27 15.15 6 14 6c-2.76 0-5 2.24-5 5 0 .5.08.97.22 1.42C8.49 13.06 8 14 8 15c0 2.21 1.79 4 4 4h14c2.21 0 4-1.79 4-4 0-1.63-.98-3.04-2.38-3.66.1-.42.13-.86.13-1.34z" />
    </svg>
  );
}

export function AWSLogo({ className = "w-7 h-4.5" }: LogoProps) {
  return (
    <svg viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} aspect-[28/18] text-[#FF9900] fill-current`} aria-hidden="true">
      <title>Amazon Web Services Integration Logo</title>
      <path d="M12.04 16.52c-2.3 0-3.66-1.12-3.66-2.92 0-2.82 2.76-3.18 5.76-3.18V9.8c0-1.42-.64-2.12-2.18-2.12-1.32 0-2.6.48-3.32.96L8 6.48C9.04 5.6 10.96 5 12.56 5c3.22 0 4.88 1.58 4.88 4.6v6.92h-2.14v-1.74c-.72 1.1-2.02 1.74-3.26 1.74zm.76-4.9c-2.08 0-3.66.18-3.66 1.48 0 .8.54 1.28 1.48 1.28 1.34 0 2.18-.8 2.18-2.06v-.7zm7.54 1.7c-.54 1.22-1.72 3.2-3.8 3.2-1.14 0-1.8-.52-2.1-1.04l1.62-1.2c.22.28.52.48.86.48.74 0 1.24-.92 1.18-1.52-.42.54-1.16.88-1.92.88-2.06 0-3.34-1.7-3.34-3.8 0-2.4 1.58-4.1 3.56-4.1.86 0 1.54.4 1.86.82v-.6h2.08v8.88zm-3.38-4.66c0 1.08.62 1.94 1.46 1.94s1.46-.86 1.46-1.94c0-1.12-.6-1.96-1.46-1.96s-1.46.84-1.46 1.96z" />
      <path d="M2.86 19.38C8.54 22.2 16.2 22.2 21.14 19c.4-.26.86.26.54.58-4.34 4.22-11.96 4.76-17.7 1.9-.44-.22-.24-.88.26-1.1z" />
    </svg>
  );
}
