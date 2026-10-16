import React, { useState } from 'react';
import { isIdentitySet, initializeIdentity, verifyIdentity, setSessionActive, getIdentity } from '../services/authService';

interface LoginProps {
  onAuthenticated: () => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const existingIdentity = getIdentity();
  const [username, setUsername] = useState(existingIdentity?.username || '');
  const [phone, setPhone] = useState(existingIdentity?.phone || '');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(!isIdentitySet());
  const [isLoading, setIsLoading] = useState(false);

  const handleResetIdentity = () => {
    if (window.confirm("Switch profile? This will clear the active profile from this local browser.")) {
      localStorage.removeItem('datasage_user_identity');
      setIsNewUser(true);
      setUsername('');
      setPhone('');
      setPasscode('');
      setConfirmPasscode('');
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      await initializeIdentity('Demo Analyst', '+1 (555) 019-2831', '1234');
      setSessionActive();
      onAuthenticated();
    } catch (err) {
      setError('Guest authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isNewUser) {
        if (username.trim().length < 2) {
          setError('Please provide a full name or analyst identifier.');
        } else if (phone.trim().length < 8) {
          setError('Please enter a valid contact phone number.');
        } else if (passcode.length < 4) {
          setError('Passcode must be at least 4 digits.');
        } else if (passcode !== confirmPasscode) {
          setError('Passcode confirmation does not match.');
        } else {
          await initializeIdentity(username.trim(), phone.trim(), passcode);
          setSessionActive();
          onAuthenticated();
        }
      } else {
        const isValid = await verifyIdentity(username, phone, passcode);
        if (isValid) {
          setSessionActive();
          onAuthenticated();
        } else {
          setError('Incorrect passcode for this analyst profile.');
        }
      }
    } catch (err) {
      setError('An authentication error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'DS';
    return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="relative min-h-screen bg-slate-50/90 text-slate-900 flex flex-col justify-between p-6 sm:p-10 antialiased overflow-hidden">
      {/* Ambient luminous background glow orbs for frosted refraction */}
      <div className="absolute top-[-8%] left-[-6%] w-[500px] h-[500px] rounded-full bg-blue-400/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-8%] w-[550px] h-[550px] rounded-full bg-indigo-400/12 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] right-[15%] w-[400px] h-[400px] rounded-full bg-sky-300/15 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[25%] left-[10%] w-[450px] h-[450px] rounded-full bg-violet-400/10 blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_2px_10px_rgba(37,99,235,0.35)] text-sm border border-white/20">
            DS
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base tracking-tight text-slate-900">DataSage</span>
            <span className="text-xs text-slate-500">Statistical Research Studio</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-700 font-mono glass-pill px-3 py-1.5 rounded-full border border-white/80 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
          <span>Local Vault Encrypted</span>
        </div>
      </div>

      {/* Main Authentication Box */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
        <div className="glass-card glass-specular rounded-2xl p-8 backdrop-blur-2xl border border-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          
          {/* Header section */}
          <div className="mb-6">
            {!isNewUser ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                  {getInitials(username)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Welcome back, {username.split(' ')[0]}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Enter passcode to unlock your workspace</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-semibold mb-3">
                  <i className="fas fa-sparkles text-[10px]"></i>
                  <span>Secure Local Profile</span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Analyst Workspace Sign In</h1>
                <p className="text-xs text-slate-500 mt-1">Set up your secure client-side profile for data exploration</p>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isNewUser && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Analyst Full Name
                  </label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Dr. Eleanor Vance"
                    className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Contact Phone Number
                  </label>
                  <input 
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {isNewUser ? "Create 4-Digit Passcode" : "Security Passcode"}
                </label>
                {!isNewUser && (
                  <button 
                    type="button" 
                    onClick={handleResetIdentity} 
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Switch Profile
                  </button>
                )}
              </div>
              <input 
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••"
                className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-widest focus:outline-none placeholder:text-slate-400"
                required
                autoFocus={!isNewUser}
              />
            </div>

            {isNewUser && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Passcode
                </label>
                <input 
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="••••"
                  className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-widest focus:outline-none placeholder:text-slate-400"
                  required
                />
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
                <i className="fas fa-exclamation-circle text-rose-500 text-sm"></i>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(37,99,235,0.25)] border border-white/20"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin text-sm"></i>
                  <span>Verifying identity...</span>
                </>
              ) : (
                <span>{isNewUser ? 'Create Profile & Enter Studio' : 'Enter Analytics Studio'}</span>
              )}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-5 pt-5 border-t border-slate-200/60">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="glass-pill w-full hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs"
            >
              <i className="fas fa-arrow-right-to-bracket text-blue-600"></i>
              <span>One-Click Demo Access (Guest Analyst)</span>
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <i className="fas fa-shield-alt text-blue-600"></i>
          <span>Client-Side SHA-256 Authentication · Zero Server Credentials</span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-200/60 pt-4">
        <div>DataSage Autonomous Data Science Studio v2.4</div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Confidential Analytical Runtime</span>
          <span>·</span>
          <span>Web Crypto Native</span>
        </div>
      </div>
    </div>
  );
};
