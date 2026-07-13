"use client";
import { useState } from 'react';
import { API_URL } from '@/lib/config';

interface User {
  id: string;
  privateAlias: string;
}

interface PrivateAppProps {
  onAuthenticated: (user: User) => void;
  onLock: () => void;
}

export default function PrivateApp({ onAuthenticated, onLock }: PrivateAppProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [alias, setAlias] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ privateAlias: alias, password, name: isRegistering ? name : undefined }),
        credentials: 'include' // Send cookies
      });

      const data = await res.json();

      if (!res.ok) {
        let errorMessage = 'Authentication failed';
        if (Array.isArray(data.error)) {
          errorMessage = data.error.map((err: any) => {
            const field = err.path && err.path.length > 0 ? `${err.path.join('.')}: ` : '';
            return `${field}${err.message}`;
          }).join(' | ');
        } else if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (data.error && typeof data.error.message === 'string') {
          errorMessage = data.error.message;
        }
        throw new Error(errorMessage);
      }

      if (isRegistering) {
        setRecoveryKey(data.recoveryKey);
      } else {
        // Logged in successfully, trigger callback
        onAuthenticated(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (recoveryKey) {
    return (
      <div className="w-full h-full bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-md w-full space-y-8 text-center bg-neutral-900 p-8 rounded-2xl shadow-2xl border border-neutral-800">
          <div className="space-y-2">
            <h2 className="text-2xl font-medium tracking-tight text-white">Save Your Recovery Key</h2>
            <p className="text-rose-400 text-sm">This is the ONLY time this key will be shown.</p>
          </div>
          
          <div className="bg-black p-4 rounded-lg border border-neutral-800 break-all text-left font-mono text-sm text-neutral-300 select-all">
            {recoveryKey}
          </div>

          <p className="text-neutral-500 text-xs text-left">
            If you lose your password, you will need this key to recover your account. Store it safely.
          </p>

          <button 
            onClick={() => { setRecoveryKey(null); setIsRegistering(false); }} 
            className="w-full px-4 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors mt-4"
          >
            I have saved it, proceed to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-sm w-full space-y-8 text-center bg-neutral-900 p-8 rounded-2xl shadow-2xl border border-neutral-800">
        <div className="space-y-2">
          <h2 className="text-2xl font-medium tracking-tight text-white">
            {isRegistering ? 'Create Identity' : 'Authentication'}
          </h2>
          <p className="text-neutral-500 text-sm">
            {isRegistering ? 'Register a new private alias.' : 'Enter your private alias and password.'}
          </p>
        </div>
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="text-rose-500 text-xs text-left bg-rose-500/10 p-2 rounded border border-rose-500/20">{error}</div>}
          
          {isRegistering && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-medium text-neutral-400 pl-1">Display Name (Optional)</label>
              <input 
                type="text" 
                placeholder="Agent Shadow" 
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-600 transition-colors text-sm text-white" 
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2 text-left">
            <label className="text-xs font-medium text-neutral-400 pl-1">Private Alias</label>
            <input 
              type="text" 
              placeholder="ghost@shadow" 
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-600 transition-colors text-sm text-white" 
              value={alias}
              onChange={e => setAlias(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-xs font-medium text-neutral-400 pl-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-600 transition-colors text-sm text-white" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full px-4 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors mt-4 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegistering ? 'Create Identity' : 'Unlock'}
          </button>
        </form>

        <div className="pt-4 flex flex-col space-y-2">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }} 
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {isRegistering ? 'Already have an identity? Login' : 'Need a new identity? Create one'}
          </button>
          
          <button onClick={onLock} className="text-xs text-neutral-600 hover:text-neutral-400">
            Cancel and return
          </button>
        </div>
      </div>
    </div>
  );
}
