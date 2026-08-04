import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const alt = 'Custodia — GDPR Compliance OS';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const fontSemiBold = await readFile(
    join(process.cwd(), 'src/assets/fonts/Geist-SemiBold.ttf')
  );
  const fontRegular = await readFile(
    join(process.cwd(), 'src/assets/fonts/Geist-Regular.ttf')
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#08090A',
          padding: '80px 90px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind logo */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '-80px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,162,39,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          <svg width="52" height="52" viewBox="0 0 48 48">
            <path d="M8 21v-6a7 7 0 0 1 7-7h6" fill="none" stroke="#E6E8EA" strokeWidth="5" strokeLinecap="round" />
            <path d="M40 27v6a7 7 0 0 1-7 7h-6" fill="none" stroke="#E6E8EA" strokeWidth="5" strokeLinecap="round" />
            <circle cx="24" cy="24" r="7.5" fill="#C9A227" />
          </svg>
          <span style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: '32px', color: '#E6E8EA', letterSpacing: '-0.01em' }}>
            Custodia
          </span>
        </div>

        {/* Gold divider */}
        <div style={{ width: '64px', height: '3px', backgroundColor: '#C9A227', marginBottom: '32px', borderRadius: '2px' }} />

        {/* Headline */}
        <h1 style={{ fontFamily: 'Geist', fontWeight: 600, fontSize: '56px', color: '#F4F5F6', lineHeight: 1.15, margin: '0 0 20px 0', letterSpacing: '-0.03em', maxWidth: '900px' }}>
          GDPR Compliance OS
        </h1>

        {/* Subheadline */}
        <p style={{ fontFamily: 'Geist', fontWeight: 400, fontSize: '24px', color: '#9BA1A6', lineHeight: 1.5, margin: 0, maxWidth: '720px' }}>
          Replace spreadsheets, consultants, and 5+ compliance tools with one platform.
        </p>

        {/* Bottom domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '60px',
            fontFamily: 'Geist',
            fontWeight: 400,
            fontSize: '16px',
            color: '#6E747A',
            letterSpacing: '0.04em',
          }}
        >
          trycustodia.com
        </div>

        {/* Subtle bottom border accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '4px',
            background: 'linear-gradient(90deg, #C9A227 0%, transparent 60%)',
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Geist',
          data: fontSemiBold,
          weight: 600,
          style: 'normal',
        },
        {
          name: 'Geist',
          data: fontRegular,
          weight: 400,
          style: 'normal',
        },
      ],
    },
  );
}
