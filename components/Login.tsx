
import React, { useState, useEffect } from 'react';
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

  // Function to clear identity and start over
  const handleResetIdentity = () => {
    if (window.confirm("Are you sure? This will remove the local identity profile from this device.")) {
      localStorage.removeItem('datasage_user_identity');
      setIsNewUser(true);
      setUsername('');
      setPhone('');
      setPasscode('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isNewUser) {
        if (username.length < 2) {
          setError('Please enter a valid name.');
        } else if (phone.length < 8) {
          setError('Please enter a valid phone number.');
        } else if (passcode.length < 4) {
          setError('Passcode must be at least 4 characters.');
        } else if (passcode !== confirmPasscode) {
          setError('Passcodes do not match.');
        } else {
          await initializeIdentity(username, phone, passcode);
          setSessionActive();
          onAuthenticated();
        }
      } else {
        // For returning users, name and phone are fixed by the profile
        const isValid = await verifyIdentity(username, phone, passcode);
        if (isValid) {
          setSessionActive();
          onAuthenticated();
        } else {
          setError('Incorrect passcode for this profile.');
        }
      }
    } catch (err) {
      setError('An authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="max-w-md w-full relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-fadeIn">
          
          <div className="text-center mb-8">
            {!isNewUser ? (
              <div className="animate-fadeInScale">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl border-4 border-slate-800">
                   <span className="text-2xl font-black text-white">{getInitials(username)}</span>
                </div>
                <h1 className="text-xl font-black text-white tracking-tight">Welcome back, {username.split(' ')[0]}</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Enter Passcode to Unlock Vault</p>
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-indigo-500/20">
                   <i className="fas fa-user-shield text-white text-2xl"></i>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Identity Setup</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Establish Your Secure Profile</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isNewUser && (
              <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                <div className="group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <i className="fas fa-user text-[10px]"></i>
                    </div>
                    <input 
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Full Name / ID"
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>

                <div className="group">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <i className="fas fa-phone text-[10px]"></i>
                    </div>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone Number"
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="group">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <i className="fas fa-lock text-[10px]"></i>
                </div>
                <input 
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={isNewUser ? "Create Passcode" : "Enter Passcode"}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all placeholder:text-slate-600"
                  required
                  autoFocus={!isNewUser}
                />
              </div>
            </div>

            {isNewUser && (
              <div className="group animate-fadeIn">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <i className="fas fa-check-double text-[10px]"></i>
                  </div>
                  <input 
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder="Confirm Passcode"
                    className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold p-3 rounded-xl flex items-center space-x-2 animate-shake">
                <i className="fas fa-exclamation-triangle"></i>
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center space-x-3 mt-4"
            >
              {isLoading ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <span className="uppercase tracking-widest text-[10px]">
                    {isNewUser ? 'Initialize Vault' : 'Unlock Portal'}
                  </span>
                  <i className={`fas ${isNewUser ? 'fa-rocket' : 'fa-unlock'} text-xs`}></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between">
            {!isNewUser && (
              <button 
                onClick={handleResetIdentity}
                className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest flex items-center"
              >
                <i className="fas fa-user-plus mr-2"></i>
                Switch Account
              </button>
            )}
            <div className="flex items-center space-x-4 ml-auto opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
               <i className="fas fa-shield-virus text-xs"></i>
               <i className="fas fa-user-shield text-xs"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
