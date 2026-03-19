"use client";

import React, { createContext, useContext } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

// Detect Electron: nodeIntegration exposes process.type and navigator contains 'Electron'
const isElectron = typeof window !== "undefined" && (
  (window.process && window.process.type === "renderer") ||
  (typeof navigator === "object" && navigator.userAgent.indexOf("Electron") >= 0)
);

// Expose this globally so components can skip Clerk UI when in Electron
export const ElectronContext = createContext(false);
export const useIsElectron = () => useContext(ElectronContext);

let convex;
try {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  }
} catch (e) {
  console.warn("[ConvexClientProvider] Failed to create ConvexReactClient:", e);
}

class ProviderErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error("[ConvexClientProvider] Provider error caught, rendering children without providers:", error);
  }
  render() {
    if (this.state.error) return this.props.children;
    return this.props.children;
  }
}

function ProvidersInner({ children }) {
  const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Skip Clerk entirely in Electron — it hangs trying to establish a dev-browser session
  if (isElectron || !hasClerkKey) return <>{children}</>;

  if (!convex) {
    return (
      <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        allowedRedirectOrigins={["http://localhost:3000", "http://localhost:3002"]}
      >
        {children}
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      allowedRedirectOrigins={["http://localhost:3000", "http://localhost:3002"]}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default function ConvexClientProvider({ children }) {
  return (
    <ElectronContext.Provider value={isElectron}>
      <ProviderErrorBoundary>
        <ProvidersInner>{children}</ProvidersInner>
      </ProviderErrorBoundary>
    </ElectronContext.Provider>
  );
}
