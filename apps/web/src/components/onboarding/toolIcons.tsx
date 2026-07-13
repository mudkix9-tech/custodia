import React from 'react';
import { 
  HubSpotLogo, 
  MailchimpLogo, 
  GA4Logo, 
  StripeLogo, 
  SlackLogo, 
  SalesforceLogo, 
  AWSLogo 
} from '../icons/BrandLogos';

export function GoogleWorkspaceLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Google Workspace Logo</title>
      <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.2-5.136 4.2a5.79 5.79 0 01-5.8-5.8 5.79 5.79 0 015.8-5.8c1.371 0 2.48.513 3.3 1.258l3.21-3.21C18.52 3.235 15.938 2 12.24 2 6.584 2 2 6.584 2 12.24s4.584 10.24 10.24 10.24c5.79 0 9.828-4.07 9.828-10A9.09 9.09 0 0022 10.285h-9.76z" fill="#4285F4"/>
    </svg>
  );
}

export function Microsoft365Logo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 23 23" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Microsoft 365 Logo</title>
      <path d="M0 0h11v11H0z" fill="#F25022"/>
      <path d="M12 0h11v11H12z" fill="#7FBA00"/>
      <path d="M0 12h11v11H0z" fill="#01A6F0"/>
      <path d="M12 12h11v11H12z" fill="#FFB900"/>
    </svg>
  );
}

export function NotionLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <title>Notion Logo</title>
      <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm2.5 4v12h2v-7.5l4.5 7.5h2.5V6h-2v7.5L9 6H6.5z" />
    </svg>
  );
}

export function ZoomLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Zoom Logo</title>
      <rect width="24" height="24" rx="5" fill="#2D8CFF" />
      <path d="M6 8.5h7a1 1 0 011 1v5a1 1 0 01-1 1H6a1 1 0 01-1-1v-5a1 1 0 011-1zm10 2l3-2v7l-3-2v-3z" fill="white" />
    </svg>
  );
}

export function QuickBooksLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>QuickBooks Logo</title>
      <rect width="24" height="24" rx="5" fill="#2CA01C" />
      <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2" fill="none" />
      <path d="M12 9v6M9 12h6" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function DropboxLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="#0061FF">
      <title>Dropbox Logo</title>
      <path d="M6 2l6 4-6 4-6-4zM18 2l6 4-6 4-6-4zM6 14.5l6-4-6-4-6 4zM18 14.5l6-4-6-4-6 4zM12 11.5l6 4-6 4-6-4zM12 20.5v-3.5l6-4v1l-6 4z" />
    </svg>
  );
}

export function ZendeskLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Zendesk Logo</title>
      <rect width="24" height="24" rx="5" fill="#03363D" />
      <path d="M7 8h3c.5 0 .9.2 1.2.6L14.7 13c.2.3.5.5.9.5h1.4c.5 0 1-.5 1-1V9h2v4c0 1.1-.9 2-2 2h-3c-.5 0-.9-.2-1.2-.6L10.3 11c-.2-.3-.5-.5-.9-.5H8c-.5 0-1 .5-1 1V15H5v-4c0-1.1.9-3 2-3z" fill="#FFF" />
    </svg>
  );
}

export function FigmaLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Figma Logo</title>
      <path d="M8 2c-2.2 0-4 1.8-4 4s1.8 4 4 4h4V2H8zm0 8c-2.2 0-4 1.8-4 4s1.8 4 4 4s4-1.8 4-4v-4H8zm8-8c-2.2 0-4 1.8-4 4v4h4c2.2 0 4-1.8 4-4s-1.8-4-4-4zm0 8c-2.2 0-4 1.8-4 4s1.8 4 4 4s4-1.8 4-4s-1.8-4-4-4zm-4-4v4h4v-4h-4z" fill="#1ABC9C" />
    </svg>
  );
}

export function ShopifyLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Shopify Logo</title>
      <path d="M19 6.5l-5.5-2-4.5.5-3 3-1 6.5 1 5 13-2 1.5-9.5-1.5-1.5zm-5 1.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" fill="#96BF48" />
    </svg>
  );
}

export function MetaLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="#0668E1">
      <title>Meta Logo</title>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function AsanaLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <title>Asana Logo</title>
      <circle cx="12" cy="7" r="3" fill="#FC636B" />
      <circle cx="7.5" cy="15" r="3" fill="#FC636B" />
      <circle cx="16.5" cy="15" r="3" fill="#FC636B" />
    </svg>
  );
}

export function GitHubLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <title>GitHub Logo</title>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function getToolIcon(id: string, className = "w-8 h-8"): React.ReactNode {
  const normalized = id.toLowerCase().replace(/_/g, '-');
  switch (normalized) {
    case 'google-workspace':
    case 'google':
      return <GoogleWorkspaceLogo className={className} />;
    case 'microsoft-365':
    case 'microsoft':
      return <Microsoft365Logo className={className} />;
    case 'slack':
      return <SlackLogo className={className} />;
    case 'zoom':
      return <ZoomLogo className={className} />;
    case 'stripe':
      return <StripeLogo className={className} />;
    case 'quickbooks':
      return <QuickBooksLogo className={className} />;
    case 'notion':
      return <NotionLogo className={className} />;
    case 'aws':
    case 'amazon-web-services':
      return <AWSLogo className={className} />;
    case 'dropbox':
      return <DropboxLogo className={className} />;
    case 'zendesk':
      return <ZendeskLogo className={className} />;
    case 'hubspot':
      return <HubSpotLogo className={className} />;
    case 'mailchimp':
      return <MailchimpLogo className={className} />;
    case 'google-analytics':
    case 'google-analytics-4':
      return <GA4Logo className={className} />;
    case 'meta':
    case 'meta-facebook':
    case 'facebook':
      return <MetaLogo className={className} />;
    case 'asana':
      return <AsanaLogo className={className} />;
    case 'figma':
      return <FigmaLogo className={className} />;
    case 'shopify':
      return <ShopifyLogo className={className} />;
    case 'github':
      return <GitHubLogo className={className} />;
    case 'salesforce':
      return <SalesforceLogo className={className} />;
    default:
      // Premium placeholder avatar using first character
      const char = id.substring(0, 1).toUpperCase();
      const colors = [
        'bg-teal-500 text-white',
        'bg-slate-500 text-white',
        'bg-indigo-500 text-white',
        'bg-amber-500 text-white',
        'bg-rose-500 text-white',
      ];
      const colorIndex = Math.abs(id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length;
      return (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${colors[colorIndex]}`}>
          {char}
        </div>
      );
  }
}
