"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PublicSite from '@/components/PublicSite';
import PrivateApp from '@/components/PrivateApp';
import Dashboard from '@/components/Dashboard';
import { API_URL, getAuthHeaders } from '@/lib/config';

interface User {
  id: string;
  privateAlias: string;
  name?: string | null;
}

export default function Portal() {
  const [unlocked, setUnlocked] = useState(false); // Controls the 3D flip to the secure section
  const [user, setUser] = useState<User | null>(null); // Stores logged in user info
  const [loading, setLoading] = useState(true);
  const [isServerDown, setIsServerDown] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // PWA Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if customizer is already unlocked
    const isUnlocked = localStorage.getItem('chat_unlocked') === 'true';
    if (isUnlocked) {
      setUnlocked(true);
    }

    // Detect iOS Device
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS and not running standalone, offer instructions
    if (isIOSDevice && !window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(true);
    }

    // Hide if already in standalone display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const checkServerStatus = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

      try {
        const res = await fetch(`${API_URL}/health`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          setIsServerDown(false);
          
          // Verify token and auto-login if token exists in localStorage
          const token = localStorage.getItem('chat_token');
          if (token) {
            try {
              const meRes = await fetch(`${API_URL}/api/auth/me`, {
                headers: getAuthHeaders()
              });
              if (meRes.ok) {
                const meData = await meRes.json();
                setUser(meData.user);
              } else {
                localStorage.removeItem('chat_token');
              }
            } catch (e) {
              console.warn('Auto-login check failed:', e);
            }
          }

          setLoading(false);
          return true;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Server status check: Offline');
      }
      return false;
    };

    const runInit = async () => {
      const isOnline = await checkServerStatus();
      if (!isOnline) {
        setIsServerDown(true);
        setLoading(false);

        // Start countdown timer
        countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              return 60; // loop countdown to show we are still retrying
            }
            return prev - 1;
          });
        }, 1000);

        // Start background polling to check if server wakes up
        checkInterval = setInterval(async () => {
          const online = await checkServerStatus();
          if (online) {
            clearInterval(checkInterval);
            clearInterval(countdownInterval);
          }
        }, 5000);
      }
    };

    runInit();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, []);

  const handleUnlock = async (code: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        setUnlocked(true);
        localStorage.setItem('chat_unlocked', 'true');
        return true;
      }
    } catch (err) {
      console.warn('Unlock verification failed:', err instanceof Error ? err.message : err);
    }
    return false;
  };

  const handleAuthenticated = (authUser: User) => {
    setUser(authUser);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_unlocked');
    setUser(null);
    setUnlocked(false);
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex items-center justify-center">
        <span className="text-sm font-light text-neutral-500 tracking-widest uppercase animate-pulse">Loading Wordplay...</span>
      </div>
    );
  }

  if (isServerDown) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8 bg-neutral-900/40 backdrop-blur-md border border-neutral-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          {/* Pulsing neon top light bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-500 to-amber-500/20 animate-pulse" />
          
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-amber-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-wider text-white uppercase">Waking Up Secure Servers</h1>
            <p className="text-sm text-neutral-400 font-light leading-relaxed">
              Our secure node goes to sleep to protect credentials when inactive. We are waking it up for you. This usually takes around 60 seconds.
            </p>
          </div>

          <div className="relative flex items-center justify-center py-6">
            {/* Pulsing countdown circle */}
            <div className="w-24 h-24 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin absolute" />
            <div className="text-3xl font-extrabold text-amber-500 font-mono tracking-wider z-10">
              {countdown}s
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2 text-[10px] uppercase font-mono tracking-widest text-neutral-500">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              <span>Establishing Encrypted Handshake...</span>
            </div>
            <span className="text-[10px] text-neutral-600 block">Please keep this window open</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-neutral-950"
      style={{ perspective: "1500px" }}
    >
      <AnimatePresence initial={false}>
        {!unlocked ? (
          <motion.div
            key="public"
            className="absolute inset-0 origin-left"
            exit={{ rotateY: -90, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: [0.64, 0.04, 0.25, 1] }}
          >
            <PublicSite onUnlock={handleUnlock} />
          </motion.div>
        ) : (
          <motion.div
            key="secure-area"
            className="absolute inset-0 origin-right w-full h-full"
            initial={{ rotateY: 90, opacity: 0, scale: 0.95 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.64, 0.04, 0.25, 1] }}
          >
            {user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <PrivateApp 
                onAuthenticated={handleAuthenticated} 
                onLock={() => setUnlocked(false)} 
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Install App FAB Button */}
      {showInstallBtn && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-full shadow-2xl border border-indigo-500/30 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group font-semibold text-xs tracking-wider uppercase cursor-pointer"
          title="Install app to your home screen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 animate-bounce">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Custom Instructions Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Install on iPhone / iPad</h3>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                Add this puzzle app to your home screen for quick offline access and standalone mode.
              </p>
            </div>
            
            <div className="bg-neutral-950 p-4 rounded-xl text-left text-xs text-neutral-400 space-y-3 font-mono leading-relaxed border border-neutral-900">
              <div className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">1.</span>
                <span>Tap the <strong className="text-white font-semibold">Share</strong> button (box with an upward arrow) at the bottom or top of Safari.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">2.</span>
                <span>Scroll down the share menu and select <strong className="text-white font-semibold">Add to Home Screen</strong>.</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
