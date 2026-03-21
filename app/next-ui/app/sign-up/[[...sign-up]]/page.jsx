"use client";

import { useSignUp } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, LogIn, AlertCircle, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CustomSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const otpRef = useRef(null);

  useEffect(() => {
    if (pendingVerification && otpRef.current) {
      otpRef.current.focus();
    }
  }, [pendingVerification]);

  // Create User & Fire Verification Email
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      // Send the email. This hits our Cloudflare Worker webhook indirectly via Clerk's email.created event
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(err.errors?.[0]?.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the OTP code
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        window.location.href = "http://localhost:3000/sso-callback";
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', backgroundColor: '#04070a', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* LEFT: Cinematic Showcase (Manim Video) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#000000', borderRight: '1px solid #1f2937' }}>
        <video 
          src="/collision.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65, filter: 'contrast(1.1) brightness(0.9)' }} 
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(8,11,20,0.4) 0%, rgba(8,11,20,0.1) 100%)' }} />
        
        <div style={{ position: 'relative', zIndex: 10, padding: '48px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', backgroundColor: '#4f46e5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ width: '16px', height: '16px', border: '2px solid white', borderRadius: '50%' }} />
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em', margin: 0 }}>openCERN.</h1>
            </div>
          </div>
          
          <div style={{ maxWidth: '450px' }}>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              style={{ fontSize: '36px', fontWeight: 600, lineHeight: 1.1, marginBottom: '16px', letterSpacing: '-0.02em' }}
            >
              Analyze complex collider topologies natively.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              style={{ fontSize: '16px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}
            >
              Request authorized access to the secure particle visualization interface backed by distributed computing arrays.
            </motion.p>
          </div>
        </div>
      </div>

      {/* RIGHT: Professional Enterprise Auth Form */}
      <div style={{ flex: '0 0 500px', backgroundColor: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', position: 'relative' }}>
        
        {/* State 1: Email Registration */}
        {!pendingVerification && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ width: '100%', maxWidth: '380px' }}
          >
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 600, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Request Access</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Create a new identity within the network.</p>
            </div>

            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginLeft: '2px' }}>Enterprise Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#11151f', border: '1px solid #1f2937', color: '#ffffff', borderRadius: '8px', padding: '12px 16px 12px 42px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '14px' }}
                    onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.backgroundColor = '#151525'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#1f2937'; e.target.style.backgroundColor = '#11151f'; }}
                    placeholder="name@axionslab.com"
                    required
                  />
                  <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af', marginLeft: '2px' }}>Secure Initial Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#11151f', border: '1px solid #1f2937', color: '#ffffff', borderRadius: '8px', padding: '12px 16px 12px 42px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '14px' }}
                    onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.backgroundColor = '#151525'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#1f2937'; e.target.style.backgroundColor = '#11151f'; }}
                    placeholder="••••••••"
                    required
                  />
                  <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#6b7280' }} />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ backgroundColor: '#1f1315', border: '1px solid #451b1f', borderRadius: '8px', padding: '12px', marginTop: '4px', display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#ef4444', fontSize: '13px' }}>
                      <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
                      <p style={{ margin: 0, lineHeight: 1.4 }}>{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                type="submit"
                style={{ width: '100%', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: 500, borderRadius: '8px', padding: '12px 16px', transition: 'background-color 0.2s', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #4338ca', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                onMouseEnter={(e) => { if(!loading) e.currentTarget.style.backgroundColor = '#4338ca'; }}
                onMouseLeave={(e) => { if(!loading) e.currentTarget.style.backgroundColor = '#4f46e5'; }}
              >
                {loading ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> : "Continue Setup"}
              </motion.button>
            </form>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #1f2937', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
              Already registered?{" "}
              <Link href="/sign-in" style={{ color: '#e5e7eb', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#ffffff'} onMouseLeave={(e) => e.target.style.color = '#e5e7eb'}>
                Authenticate locally
              </Link>
            </div>
          </motion.div>
        )}

        {/* State 2: OTP Verification Setup */}
        {pendingVerification && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ width: '100%', maxWidth: '380px' }}
          >
            <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#11151f', border: '1px solid #1f2937', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <ShieldCheck style={{ width: '24px', height: '24px', color: '#4f46e5' }} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Identity Verification</h2>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
              We&apos;ve transmitted a specialized single-use code to <strong style={{ color: '#e5e7eb', fontWeight: 500 }}>{emailAddress}</strong>. Enter it below to validate your environment.
            </p>
            </div>

            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '2px' }}>Access Protocol Code</label>
                <input
                  ref={otpRef}
                  type="text"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', backgroundColor: '#0a0d14', border: 'none', borderBottom: '2px solid #1f2937', color: '#ffffff', padding: '16px 0', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s', fontSize: '36px', fontWeight: 600, letterSpacing: '0.4em', textAlign: 'center', fontFamily: 'monospace' }}
                  onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; }}
                  onBlur={(e) => { if (!code) e.target.style.borderColor = '#1f2937'; }}
                  placeholder="------"
                  required
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ backgroundColor: '#1f1315', border: '1px solid #451b1f', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#ef4444', fontSize: '13px' }}>
                      <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
                      <p style={{ margin: 0, lineHeight: 1.4 }}>{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading || code.length !== 6}
                type="submit"
                style={{ width: '100%', backgroundColor: code.length === 6 ? '#ffffff' : '#1f2937', color: code.length === 6 ? '#000000' : '#6b7280', fontWeight: 600, borderRadius: '8px', padding: '14px 16px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer', fontSize: '15px', marginTop: '8px' }}
              >
                {loading ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> : (
                  <>Verify Protocol <ArrowRight style={{ width: '16px', height: '16px' }} /></>
                )}
              </motion.button>
            </form>
            
            <div style={{ marginTop: '32px', textAlign: 'center' }}>
               <button 
                  onClick={() => setPendingVerification(false)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer', transition: 'color 0.2s', padding: 0 }}
                  onMouseEnter={(e) => e.target.style.color = '#9ca3af'}
                  onMouseLeave={(e) => e.target.style.color = '#6b7280'}
               >
                 Cancel / Use different identifier
               </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
