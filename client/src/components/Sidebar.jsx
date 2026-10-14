import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import {
  MessageSquare,
  Search,
  UserPlus,
  Users,
  LogOut,
  Sparkles,
  Circle,
  Plus,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

export const Sidebar = ({ onOpenSwitcher }) => {
  const {
    currentUser,
    setCurrentUser,
    conversations,
    activeConversation,
    selectConversation,
    allUsers,
    startConversationWithUser,
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isToday(date)) return format(date, 'h:mm a');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (conv.isGroup) {
      return conv.name?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    const otherParticipant = conv.participants.find((p) => p._id !== currentUser?._id);
    return (
      otherParticipant?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      otherParticipant?.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <aside className="w-80 md:w-96 flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none">
      {/* Current User Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src={currentUser?.avatar}
              alt={currentUser?.displayName}
              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentUser?.displayName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              @{currentUser?.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewChatModal(true)}
            title="Start New Chat"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={onOpenSwitcher}
            title="Switch User Profile"
            className="p-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
          >
            <Sparkles size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search chats or contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <MessageSquare size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              No conversations yet
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
              Click the <span className="font-bold">+</span> icon above or start a chat with any contact below!
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 transition"
            >
              Browse Contacts
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = activeConversation?._id === conv._id;
            const otherParticipant = conv.participants.find((p) => p._id !== currentUser?._id);
            const unreadCount = (conv.unreadCounts && conv.unreadCounts[currentUser?._id]) || 0;
            const isOnline = otherParticipant?.isOnline;

            return (
              <button
                key={conv._id}
                onClick={() => selectConversation(conv)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left relative ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.isGroup ? 'https://api.dicebear.com/7.x/identicon/svg?seed=group' : otherParticipant?.avatar}
                    alt="avatar"
                    className="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 object-cover"
                  />
                  {!conv.isGroup && (
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3
                      className={`text-xs font-semibold truncate ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {conv.isGroup ? conv.name : otherParticipant?.displayName || 'Unknown Contact'}
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                      {formatMessageTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs truncate ${
                        conv.lastMessage?.isDeleted
                          ? 'italic text-slate-400'
                          : unreadCount > 0
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {conv.lastMessage?.text || 'No messages yet'}
                    </p>

                    {unreadCount > 0 && (
                      <span className="ml-2 flex-shrink-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={16} /> New Conversation
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Select any registered user to initiate a direct chat:
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {allUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No other users found.</p>
              ) : (
                allUsers.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => {
                      startConversationWithUser(user._id);
                      setShowNewChatModal(false);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                  >
                    <div className="relative">
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          user.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {user.displayName}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        @{user.username} • {user.isOnline ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
