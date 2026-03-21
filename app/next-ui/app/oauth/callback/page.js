// OAuth callback page — receives the authorization code from Claude
// GET /oauth/callback?code=...&state=...

'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

function OAuthCallbackInner() {
  const searchParams = useSearchParams();
  const hasRun = useRef(false);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const status = useMemo(() => {
    if (error) return `Authorization denied: ${error}`;
    if (!code) return 'No authorization code received.';
    return 'Connected! You can close this window.';
  }, [error, code]);

  useEffect(() => {
    if (hasRun.current || !code) return;
    hasRun.current = true;

    try {
      localStorage.setItem('opencern-oauth-result', JSON.stringify({ code, state, timestamp: Date.now() }));
      setTimeout(() => window.close(), 1500);
    } catch {
      // Storage write failed — status already shows fallback
    }
  }, [code, state]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f0f11', color: '#ccc',
      fontFamily: 'system-ui, sans-serif', fontSize: '15px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
        <div>{status}</div>
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f0f11', color: '#ccc',
        fontFamily: 'system-ui, sans-serif', fontSize: '15px',
      }}>
        <div>Processing...</div>
      </div>
    }>
      <OAuthCallbackInner />
    </Suspense>
  );
}
