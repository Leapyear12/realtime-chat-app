import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import {
  Send,
  Trash2,
  Check,
  CheckCheck,
  MoreVertical,
  Smile,
  ShieldAlert,
  MessageCircle,
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export const ChatWindow = () => {
  const {
    currentUser,
    activeConversation,
    messages,
    sendMessage,
    deleteMessage,
    sendTypingStart,
    sendTypingStop,
    typingState,
    isLoadingMessages,
  } = useChat();

  const [inputMessage, setInputMessage] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingState]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-xs">
          <MessageCircle size={32} />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          No Conversation Selected
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Pick a conversation from the sidebar or click '+' to start a new real-time conversation.
        </p>
      </div>
    );
  }

  // Get recipient info
  const otherParticipant = activeConversation.participants?.find(
    (p) => p._id !== currentUser?._id
  );

  const activeTypingUsers = typingState[activeConversation._id]
    ? Object.values(typingState[activeConversation._id])
    : [];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMessage(val);

    if (val.trim()) {
      sendTypingStart();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop();
      }, 1500);
    } else {
      sendTypingStop();
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStop();

    sendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatMessageTime = (dateString) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return '';
    }
  };

  const renderStatusTicks = (msg) => {
    if (msg.status === 'read') {
      return <CheckCheck size={14} className="text-sky-400 dark:text-sky-300 stroke-[2.5]" title="Read" />;
    }
    if (msg.status === 'delivered') {
      return <CheckCheck size={14} className="text-slate-400 dark:text-slate-400" title="Delivered" />;
    }
    return <Check size={14} className="text-slate-400 dark:text-slate-400" title="Sent" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={
                activeConversation.isGroup
                  ? 'https://api.dicebear.com/7.x/identicon/svg?seed=group'
                  : otherParticipant?.avatar
              }
              alt="avatar"
              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 object-cover"
            />
            {!activeConversation.isGroup && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                  otherParticipant?.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {activeConversation.isGroup
                ? activeConversation.name
                : otherParticipant?.displayName || 'Chat'}
            </h2>
            <div className="text-[11px] flex items-center gap-1.5">
              {activeTypingUsers.length > 0 ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse flex items-center gap-1">
                  <span>typing</span>
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></span>
                  </span>
                </span>
              ) : otherParticipant?.isOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active now</span>
              ) : otherParticipant?.lastSeen ? (
                <span className="text-slate-400">
                  Last seen {formatDistanceToNow(new Date(otherParticipant.lastSeen), { addSuffix: true })}
                </span>
              ) : (
                <span className="text-slate-400">Offline</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <div className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            WebSockets Live
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-xs text-slate-400">
              No messages here yet. Say hello and start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender?._id === currentUser?._id || msg.sender === currentUser?._id;
            const isDeleting = deleteConfirmId === msg._id;

            return (
              <div
                key={msg._id || index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                <div
                  className={`relative max-w-sm sm:max-w-md md:max-w-lg px-4 py-2.5 rounded-2xl text-xs transition shadow-xs ${
                    isMe
                      ? msg.isDeleted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 italic border border-slate-200 dark:border-slate-700 rounded-br-xs'
                        : 'bg-blue-600 text-white rounded-br-xs'
                      : msg.isDeleted
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 italic border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 rounded-bl-xs'
                  }`}
                >
                  {/* Delete trigger on hover (only for sender's non-deleted messages) */}
                  {isMe && !msg.isDeleted && (
                    <div className="absolute top-1 -left-8 opacity-0 group-hover:opacity-100 transition flex items-center">
                      <button
                        onClick={() => setDeleteConfirmId(msg._id)}
                        title="Delete message"
                        className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="break-words whitespace-pre-wrap leading-relaxed">
                    {msg.isDeleted ? (
                      <span className="flex items-center gap-1.5 opacity-80">
                        <ShieldAlert size={13} className="text-slate-400" />
                        This message was deleted
                      </span>
                    ) : (
                      msg.text
                    )}
                  </div>

                  {/* Footer: Timestamp and Status Ticks */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe
                        ? msg.isDeleted
                          ? 'text-slate-400'
                          : 'text-blue-100/90'
                        : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && !msg.isDeleted && (
                      <span className="flex items-center ml-0.5">
                        {renderStatusTicks(msg)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation Popover */}
                {isDeleting && (
                  <div className="mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg flex items-center gap-2 z-20 animate-in fade-in zoom-in-95">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      Delete for everyone?
                    </span>
                    <button
                      onClick={() => {
                        deleteMessage(msg._id);
                        setDeleteConfirmId(null);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-medium rounded-md transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] rounded-md transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Real-time typing bubble */}
        {activeTypingUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <img
              src={otherParticipant?.avatar}
              alt="avatar"
              className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700"
            />
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Message ${otherParticipant?.displayName || ''}...`}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 text-xs px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-xs transition flex items-center justify-center"
            title="Send message"
          >
            <Send size={16} />
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400">
          <span>Press Enter to send, Shift + Enter for new line</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <Check size={12} /> Sent
            </span>
            <span className="flex items-center gap-0.5">
              <CheckCheck size={12} /> Delivered
            </span>
            <span className="flex items-center gap-0.5 text-sky-500 font-medium">
              <CheckCheck size={12} /> Read
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
