import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { format } from 'date-fns';

const SOCKET_URL = 'http://localhost:5000';

const PRESET_USERS = [
  { username: 'alex', displayName: 'Alex' },
  { username: 'sarah', displayName: 'Sarah' },
  { username: 'david', displayName: 'David' },
  { username: 'elena', displayName: 'Elena' },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [customName, setCustomName] = useState('');

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const conversationRef = useRef(null);
  conversationRef.current = conversation;

  // Initialize Socket.io connection when currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    localStorage.setItem('chat_user', JSON.stringify(currentUser));

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('user:online', { userId: currentUser._id });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Receive new message
    socket.on('message:new', ({ conversationId, message }) => {
      if (conversationRef.current?._id === conversationId) {
        setMessages((prev) => [...prev, message]);

        // Auto mark as read if message is from the other person
        if (message.sender?._id !== currentUser._id && message.sender !== currentUser._id) {
          socket.emit('messages:mark_read', {
            conversationId,
            userId: currentUser._id,
          });
        }
      }
    });

    // Message deleted
    socket.on('message:deleted', ({ conversationId, messageId, text }) => {
      if (conversationRef.current?._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text } : m))
        );
      }
    });

    // Read receipt updated (double blue ticks)
    socket.on('messages:read', ({ conversationId, messageIds }) => {
      if (conversationRef.current?._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (messageIds.includes(m._id) ? { ...m, status: 'read' } : m))
        );
      }
    });

    // Typing status
    socket.on('typing:status', ({ conversationId, userId, displayName, isTyping }) => {
      if (conversationRef.current?._id === conversationId && userId !== currentUser._id) {
        setTypingUser(isTyping ? displayName : null);
      }
    });

    // User online status update
    socket.on('user:status_changed', ({ userId, isOnline }) => {
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isOnline } : u))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  // Load user list
  const loadUsers = async () => {
    try {
      await axios.post('/api/users/seed').catch(() => {});
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Select user profile to chat as
  const handleSelectUser = async (username, displayName) => {
    try {
      const res = await axios.post('/api/auth/login-or-register', {
        username,
        displayName: displayName || username,
      });
      setCurrentUser(res.data.user);
      setActiveUser(null);
      setConversation(null);
      setMessages([]);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  // Open chat with a user
  const openChatWith = async (targetUser) => {
    if (!currentUser) return;
    setActiveUser(targetUser);

    try {
      const res = await axios.post('/api/conversations', {
        participantIds: [currentUser._id, targetUser._id],
      });
      const conv = res.data;
      setConversation(conv);

      // Fetch messages
      const msgRes = await axios.get(`/api/conversations/${conv._id}/messages`);
      setMessages(msgRes.data);

      // Join socket room & mark as read
      if (socketRef.current) {
        socketRef.current.emit('conversation:join', {
          conversationId: conv._id,
          userId: currentUser._id,
        });
      }
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  // Handle typing input
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputMessage(val);

    if (!conversation || !socketRef.current) return;

    if (val.trim()) {
      if (!isTyping) {
        setIsTyping(true);
        socketRef.current.emit('typing:start', {
          conversationId: conversation._id,
          userId: currentUser._id,
          displayName: currentUser.displayName,
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socketRef.current?.emit('typing:stop', {
          conversationId: conversation._id,
          userId: currentUser._id,
        });
      }, 1500);
    } else {
      setIsTyping(false);
      socketRef.current.emit('typing:stop', {
        conversationId: conversation._id,
        userId: currentUser._id,
      });
    }
  };

  // Send message
  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !conversation || !socketRef.current) return;

    socketRef.current.emit('typing:stop', {
      conversationId: conversation._id,
      userId: currentUser._id,
    });
    setIsTyping(false);

    socketRef.current.emit('message:send', {
      conversationId: conversation._id,
      senderId: currentUser._id,
      text: inputMessage.trim(),
    });

    setInputMessage('');
  };

  // Delete message
  const handleDelete = (messageId) => {
    if (!socketRef.current || !conversation) return;
    socketRef.current.emit('message:delete', {
      messageId,
      conversationId: conversation._id,
      userId: currentUser._id,
    });
  };

  // Format timestamp
  const formatTime = (ts) => {
    try {
      return format(new Date(ts), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-800 font-mono text-xs">
      {/* Minimal Top Header */}
      <header className="h-12 bg-white border-b border-slate-300 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-slate-900 tracking-tight">
            ⚡ Chat Backend Testbench
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              socketConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {socketConnected ? '● WebSocket Live' : '○ Offline'}
          </span>
        </div>

        {/* User Switcher Controls */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Current User:</span>
          {currentUser ? (
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-300">
              {currentUser.displayName} (@{currentUser.username})
            </span>
          ) : (
            <span className="text-amber-600 font-medium">None selected</span>
          )}

          <select
            value={currentUser?.username || ''}
            onChange={(e) => {
              const u = PRESET_USERS.find((p) => p.username === e.target.value);
              if (u) handleSelectUser(u.username, u.displayName);
            }}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs cursor-pointer focus:outline-none"
          >
            <option value="" disabled>
              -- Switch User --
            </option>
            {PRESET_USERS.map((p) => (
              <option key={p.username} value={p.username}>
                {p.displayName} (@{p.username})
              </option>
            ))}
          </select>

          {/* Quick custom username input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customName.trim()) {
                handleSelectUser(customName.trim(), customName.trim());
                setCustomName('');
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              placeholder="or custom user"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs w-28 bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="bg-slate-800 text-white px-2 py-1 rounded text-xs hover:bg-slate-700"
            >
              Set
            </button>
          </form>
        </div>
      </header>

      {/* Main Area: Sidebar + Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Minimal Contacts Sidebar */}
        <aside className="w-56 bg-white border-r border-slate-300 flex flex-col">
          <div className="p-2 border-b border-slate-200 font-semibold text-slate-500 uppercase text-[10px]">
            Contacts / Users
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {users
              .filter((u) => u._id !== currentUser?._id)
              .map((u) => {
                const isActive = activeUser?._id === u._id;
                return (
                  <button
                    key={u._id}
                    onClick={() => openChatWith(u)}
                    className={`w-full text-left p-2.5 flex items-center justify-between transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-900 font-bold border-l-2 border-blue-600'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{u.displayName}</span>
                    <span
                      title={u.isOnline ? 'Online' : 'Offline'}
                      className={`w-2 h-2 rounded-full ${
                        u.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
          </div>
        </aside>

        {/* Minimal Chat Window */}
        <main className="flex-1 flex flex-col bg-slate-50">
          {!currentUser ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select or enter a user at top to start.
            </div>
          ) : !activeUser ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a contact on the left to test real-time messaging.
            </div>
          ) : (
            <>
              {/* Chat Subheader */}
              <div className="h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{activeUser.displayName}</span>
                  <span className="text-[10px] text-slate-400">
                    ({activeUser.isOnline ? 'Active now' : 'Offline'})
                  </span>
                </div>
                {typingUser && (
                  <span className="text-blue-600 text-[11px] animate-pulse">
                    {typingUser} is typing...
                  </span>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    No messages yet. Send a message below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender?._id === currentUser._id || m.sender === currentUser._id;
                    return (
                      <div
                        key={m._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-2.5 rounded border ${
                            isMe
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-white text-slate-900 border-slate-200'
                          }`}
                        >
                          <div className={m.isDeleted ? 'italic opacity-70' : ''}>
                            {m.text}
                          </div>

                          <div
                            className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] ${
                              isMe ? 'text-blue-200' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatTime(m.createdAt)}</span>

                            {/* Status Ticks (Sent ✓, Delivered ✓✓, Read ✓✓ Blue) */}
                            {isMe && !m.isDeleted && (
                              <span>
                                {m.status === 'read' ? (
                                  <span className="text-sky-300 font-bold" title="Read">
                                    ✓✓
                                  </span>
                                ) : m.status === 'delivered' ? (
                                  <span title="Delivered">✓✓</span>
                                ) : (
                                  <span title="Sent">✓</span>
                                )}
                              </span>
                            )}

                            {/* Inline Delete Button */}
                            {isMe && !m.isDeleted && (
                              <button
                                onClick={() => handleDelete(m._id)}
                                className="ml-2 underline opacity-70 hover:opacity-100 text-rose-200"
                                title="Delete for everyone"
                              >
                                [delete]
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Minimal Input Bar */}
              <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  placeholder={`Message ${activeUser.displayName}...`}
                  value={inputMessage}
                  onChange={handleInputChange}
                  className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
