// OAuth callback page — receives the authorization code from Claude
// GET /oauth/callback?code=...&state=...

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function OAuthCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus(`Authorization denied: ${error}`);
      return;
    }

    if (!code) {
      setStatus('No authorization code received.');
      return;
    }

    // Send the code back to the parent window via localStorage event
    // The main app listens for this
    try {
      localStorage.setItem('opencern-oauth-result', JSON.stringify({ code, state, timestamp: Date.now() }));
      setStatus('Connected! You can close this window.');
      // Auto-close after a moment
      setTimeout(() => window.close(), 1500);
    } catch (err) {
      setStatus('Failed to save authorization code.');
    }
  }, [searchParams]);

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
