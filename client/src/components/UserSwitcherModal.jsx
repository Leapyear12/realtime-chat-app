import React, { useState } from 'react';
import axios from 'axios';
import { useChat } from '../context/ChatContext';
import { UserPlus, UserCheck, X, Sparkles } from 'lucide-react';

const PRESET_USERS = [
  { username: 'alex', displayName: 'Alex Rivers', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', role: 'Frontend Dev' },
  { username: 'sarah', displayName: 'Sarah Connor', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', role: 'Product Lead' },
  { username: 'david', displayName: 'David Kim', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david', role: 'Backend Dev' },
  { username: 'elena', displayName: 'Elena Rostova', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena', role: 'UX Designer' },
];

export const UserSwitcherModal = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, refreshUsers } = useChat();
  const [customUsername, setCustomUsername] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen && currentUser) return null;

  const handleLogin = async (username, displayName) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login-or-register', {
        username,
        displayName: displayName || username,
      });

      if (res.data?.user) {
        setCurrentUser(res.data.user);
        refreshUsers();
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customUsername.trim()) return;
    handleLogin(customUsername.trim(), customDisplayName.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
        {currentUser && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition"
          >
            <X size={20} />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-3">
            <Sparkles size={26} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {currentUser ? 'Switch User Profile' : 'Welcome to Real-Time Chat'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Select a demo profile or enter your custom handle to start chatting
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        {/* Preset quick profiles */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Quick Demo Profiles
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {PRESET_USERS.map((user) => {
              const isSelected = currentUser?.username === user.username;
              return (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => handleLogin(user.username, user.displayName)}
                  disabled={loading}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  <div className="truncate">
                    <div className="text-xs font-medium text-slate-900 dark:text-white truncate flex items-center gap-1">
                      {user.displayName}
                      {isSelected && <UserCheck size={13} className="text-blue-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      @{user.username}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-3 text-xs text-slate-400 font-medium">or custom handle</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        {/* Custom handle form */}
        <form onSubmit={handleCustomSubmit} className="space-y-3 mt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Username Handle
            </label>
            <input
              type="text"
              placeholder="e.g. charlie"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Charlie Parker"
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !customUsername.trim()}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <UserPlus size={16} />
            {loading ? 'Joining...' : 'Enter Chat Room'}
          </button>
        </form>
      </div>
    </div>
  );
};
