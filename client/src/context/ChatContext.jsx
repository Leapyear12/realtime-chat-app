import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const ChatContext = createContext();

const SOCKET_SERVER_URL = 'http://localhost:5000';

export const ChatProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [typingState, setTypingState] = useState({}); // { [conversationId]: { [userId]: displayName } }
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const socketRef = useRef(null);
  const activeConvRef = useRef(activeConversation);
  activeConvRef.current = activeConversation;

  // Save currentUser to localStorage
  const handleSetCurrentUser = (user) => {
    if (user) {
      localStorage.setItem('chat_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('chat_user');
    }
    setCurrentUser(user);
  };

  // Connect socket when user is logged in
  useEffect(() => {
    if (!currentUser?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to server as:', currentUser.username);
      socket.emit('user:online', { userId: currentUser._id });
    });

    // Handle incoming message
    socket.on('message:new', ({ conversationId, message }) => {
      console.log('[Socket] New message received:', message);

      const isCurrentChat = activeConvRef.current && activeConvRef.current._id === conversationId;

      if (isCurrentChat) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // If the message is from someone else and user is viewing it, mark as read
        if (message.sender?._id !== currentUser._id) {
          socket.emit('messages:mark_read', {
            conversationId,
            userId: currentUser._id,
          });
        }
      }

      // Update sidebar conversation list
      setConversations((prev) => {
        const found = prev.find((c) => c._id === conversationId);
        if (!found) {
          fetchConversations(currentUser._id);
          return prev;
        }

        const updated = prev.map((c) => {
          if (c._id === conversationId) {
            const currentUnread = (c.unreadCounts && c.unreadCounts[currentUser._id]) || 0;
            return {
              ...c,
              lastMessage: {
                text: message.text,
                sender: message.sender?._id || message.sender,
                createdAt: message.createdAt,
                isDeleted: message.isDeleted,
              },
              unreadCounts: {
                ...c.unreadCounts,
                [currentUser._id]: isCurrentChat ? 0 : currentUnread + 1,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        });

        // Sort latest first
        return updated.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
    });

    // Handle message deleted
    socket.on('message:deleted', ({ conversationId, messageId, text }) => {
      if (activeConvRef.current && activeConvRef.current._id === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, isDeleted: true, text } : msg
          )
        );
      }

      // Update lastMessage preview in conversations if it was the deleted message
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === conversationId && c.lastMessage) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                text,
                isDeleted: true,
              },
            };
          }
          return c;
        })
      );
    });

    // Handle read receipt updates
    socket.on('messages:read', ({ conversationId, messageIds, readByUserId, readAt }) => {
      if (activeConvRef.current && activeConvRef.current._id === conversationId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (messageIds.includes(msg._id)) {
              return {
                ...msg,
                status: 'read',
                readBy: [...(msg.readBy || []), { user: readByUserId, readAt }],
              };
            }
            return msg;
          })
        );
      }
    });

    // Handle typing status updates
    socket.on('typing:status', ({ conversationId, userId, displayName, isTyping }) => {
      if (userId === currentUser._id) return;
      setTypingState((prev) => {
        const convTyping = { ...(prev[conversationId] || {}) };
        if (isTyping) {
          convTyping[userId] = displayName;
        } else {
          delete convTyping[userId];
        }
        return { ...prev, [conversationId]: convTyping };
      });
    });

    // Handle user online/offline presence
    socket.on('user:status_changed', ({ userId, isOnline, lastSeen }) => {
      setAllUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isOnline, lastSeen } : u))
      );

      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === userId ? { ...p, isOnline, lastSeen } : p
          ),
        }))
      );

      if (activeConvRef.current) {
        setActiveConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p._id === userId ? { ...p, isOnline, lastSeen } : p
            ),
          };
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?._id]);

  // Fetch conversations
  const fetchConversations = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`/api/conversations?userId=${userId}`);
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }, []);

  // Fetch all registered users
  const fetchUsers = useCallback(async (currentUserId) => {
    try {
      const res = await axios.get(`/api/users?currentUserId=${currentUserId || ''}`);
      setAllUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  // Load conversations and all users when user logs in
  useEffect(() => {
    if (currentUser?._id) {
      fetchConversations(currentUser._id);
      fetchUsers(currentUser._id);
    }
  }, [currentUser?._id, fetchConversations, fetchUsers]);

  // Select a conversation and load message history
  const selectConversation = async (conversation) => {
    if (activeConversation?._id === conversation._id) return;

    // Leave previous room if any
    if (socketRef.current && activeConversation) {
      socketRef.current.emit('conversation:leave', { conversationId: activeConversation._id });
    }

    setActiveConversation(conversation);
    setIsLoadingMessages(true);

    try {
      const res = await axios.get(`/api/conversations/${conversation._id}/messages`);
      setMessages(res.data);

      // Join new socket room and auto mark unread
      if (socketRef.current && currentUser) {
        socketRef.current.emit('conversation:join', {
          conversationId: conversation._id,
          userId: currentUser._id,
        });
      }

      // Reset local unread indicator
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversation._id
            ? {
                ...c,
                unreadCounts: {
                  ...c.unreadCounts,
                  [currentUser._id]: 0,
                },
              }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Start new 1-on-1 chat or open existing
  const startConversationWithUser = async (targetUserId) => {
    if (!currentUser) return;
    try {
      const res = await axios.post('/api/conversations', {
        participantIds: [currentUser._id, targetUserId],
        isGroup: false,
      });

      const conversation = res.data;
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conversation._id);
        if (exists) return prev;
        return [conversation, ...prev];
      });

      selectConversation(conversation);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // Send message
  const sendMessage = (text) => {
    if (!text.trim() || !activeConversation || !currentUser || !socketRef.current) return;

    socketRef.current.emit(
      'message:send',
      {
        conversationId: activeConversation._id,
        senderId: currentUser._id,
        text: text.trim(),
      },
      (response) => {
        if (response?.error) {
          console.error('Failed to send message:', response.error);
        }
      }
    );
  };

  // Delete message (Real-time)
  const deleteMessage = (messageId) => {
    if (!messageId || !activeConversation || !currentUser || !socketRef.current) return;

    socketRef.current.emit(
      'message:delete',
      {
        messageId,
        conversationId: activeConversation._id,
        userId: currentUser._id,
      },
      (response) => {
        if (response?.error) {
          console.error('Failed to delete message:', response.error);
        }
      }
    );
  };

  // Typing indicators
  const sendTypingStart = () => {
    if (!activeConversation || !currentUser || !socketRef.current) return;
    socketRef.current.emit('typing:start', {
      conversationId: activeConversation._id,
      userId: currentUser._id,
      displayName: currentUser.displayName,
    });
  };

  const sendTypingStop = () => {
    if (!activeConversation || !currentUser || !socketRef.current) return;
    socketRef.current.emit('typing:stop', {
      conversationId: activeConversation._id,
      userId: currentUser._id,
    });
  };

  return (
    <ChatContext.Provider
      value={{
        currentUser,
        setCurrentUser: handleSetCurrentUser,
        conversations,
        activeConversation,
        messages,
        allUsers,
        typingState,
        isLoadingMessages,
        selectConversation,
        startConversationWithUser,
        sendMessage,
        deleteMessage,
        sendTypingStart,
        sendTypingStop,
        refreshUsers: () => fetchUsers(currentUser?._id),
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
