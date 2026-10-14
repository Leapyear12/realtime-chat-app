const chatService = require('../services/chatService');

const setupChatSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Register user online
    socket.on('user:online', async ({ userId }) => {
      if (!userId) return;
      try {
        socket.userId = userId;
        socket.join(`user:${userId}`);

        const user = await chatService.setUserOnlineStatus(userId, true, socket.id);
        if (user) {
          io.emit('user:status_changed', {
            userId: user._id,
            isOnline: true,
            lastSeen: user.lastSeen,
          });
          console.log(`[Socket] User ${user.username} (${userId}) is online`);
        }
      } catch (err) {
        console.error('[Socket Error] user:online:', err.message);
      }
    });

    // Join conversation room & auto mark unread messages
    socket.on('conversation:join', async ({ conversationId, userId }, callback) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`[Socket] User ${userId || socket.id} joined conversation ${conversationId}`);

      if (userId) {
        try {
          const { messageIds, readAt } = await chatService.markMessagesAsRead({
            conversationId,
            userId,
          });

          if (messageIds.length > 0) {
            io.to(conversationId).emit('messages:read', {
              conversationId,
              messageIds,
              readByUserId: userId,
              readAt,
            });
          }
        } catch (err) {
          console.error('[Socket Error] auto mark read on join:', err.message);
        }
      }

      if (callback) callback({ success: true, conversationId });
    });

    // Leave conversation room
    socket.on('conversation:leave', ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(conversationId);
      console.log(`[Socket] Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Send a message
    socket.on('message:send', async ({ conversationId, senderId, text }, callback) => {
      try {
        const { message, conversation, otherParticipantIds } = await chatService.sendMessage({
          conversationId,
          senderId,
          text,
        });

        // Broadcast to conversation room
        io.to(conversationId).emit('message:new', {
          conversationId,
          message,
        });

        // Notify other participants for real-time sidebar list updates
        otherParticipantIds.forEach((pId) => {
          io.to(`user:${pId}`).emit('conversation:updated', {
            conversationId,
            lastMessage: {
              text: message.text,
              sender: senderId,
              createdAt: message.createdAt,
              isDeleted: false,
            },
          });
        });

        if (callback) callback({ success: true, message });
      } catch (err) {
        console.error('[Socket Error] message:send:', err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // Delete message (Real-time soft delete)
    socket.on('message:delete', async ({ messageId, conversationId, userId }, callback) => {
      try {
        const { message, conversationId: targetConvId, participants } = await chatService.deleteMessage({
          messageId,
          userId,
        });

        // Broadcast to conversation room
        io.to(targetConvId).emit('message:deleted', {
          conversationId: targetConvId,
          messageId: message._id,
          text: message.text,
        });

        // Update participants' conversation previews
        participants.forEach((pId) => {
          io.to(`user:${pId}`).emit('conversation:updated', {
            conversationId: targetConvId,
            lastMessage: {
              text: message.text,
              sender: userId,
              createdAt: message.updatedAt,
              isDeleted: true,
            },
          });
        });

        if (callback) callback({ success: true });
      } catch (err) {
        console.error('[Socket Error] message:delete:', err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // Mark messages as read explicitly
    socket.on('messages:mark_read', async ({ conversationId, userId }) => {
      try {
        const { messageIds, readAt } = await chatService.markMessagesAsRead({
          conversationId,
          userId,
        });

        if (messageIds.length > 0) {
          io.to(conversationId).emit('messages:read', {
            conversationId,
            messageIds,
            readByUserId: userId,
            readAt,
          });
        }
      } catch (err) {
        console.error('[Socket Error] messages:mark_read:', err.message);
      }
    });

    // Typing start
    socket.on('typing:start', ({ conversationId, userId, displayName }) => {
      if (!conversationId || !userId) return;
      socket.to(conversationId).emit('typing:status', {
        conversationId,
        userId,
        displayName: displayName || 'Someone',
        isTyping: true,
      });
    });

    // Typing stop
    socket.on('typing:stop', ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      socket.to(conversationId).emit('typing:status', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (socket.userId) {
        try {
          const user = await chatService.setUserOnlineStatus(socket.userId, false, null);
          if (user) {
            io.emit('user:status_changed', {
              userId: user._id,
              isOnline: false,
              lastSeen: user.lastSeen,
            });
            console.log(`[Socket] User ${user.username} (${user._id}) went offline`);
          }
        } catch (err) {
          console.error('[Socket Error] disconnect:', err.message);
        }
      }
    });
  });
};

module.exports = setupChatSocket;
