const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const User = require('../models/User');

// Auth: Login or register user
router.post('/auth/login-or-register', async (req, res, next) => {
  try {
    const { username, displayName } = req.body;
    const user = await chatService.loginOrRegisterUser({ username, displayName });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// Users: Get all users
router.get('/users', async (req, res, next) => {
  try {
    const { currentUserId } = req.query;
    const users = await chatService.getAllUsers(currentUserId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Seed default users if empty
router.post('/users/seed', async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      const demoUsers = [
        {
          username: 'alex',
          displayName: 'Alex Rivers',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
          isOnline: false,
        },
        {
          username: 'sarah',
          displayName: 'Sarah Connor',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
          isOnline: false,
        },
        {
          username: 'david',
          displayName: 'David Kim',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david',
          isOnline: false,
        },
        {
          username: 'elena',
          displayName: 'Elena Rostova',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=elena',
          isOnline: false,
        },
      ];
      const created = await User.insertMany(demoUsers);
      return res.json({ message: 'Seeded default users', users: created });
    }
    const existing = await User.find();
    res.json({ message: 'Users already exist', users: existing });
  } catch (err) {
    next(err);
  }
});

// Conversations: Get user conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const conversations = await chatService.getUserConversations(userId);
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

// Conversations: Create or get conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const { participantIds, isGroup, name } = req.body;
    const conversation = await chatService.getOrCreateConversation({
      participantIds,
      isGroup,
      name,
    });
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

// Messages: Get messages for a conversation (supports pagination: ?limit=50&before=2026-09-18T...)
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit, before } = req.query;
    const messages = await chatService.getConversationMessages(id, { limit, before });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// Messages: HTTP fallback for sending a message
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { senderId, text } = req.body;
    const result = await chatService.sendMessage({
      conversationId: id,
      senderId,
      text,
    });
    res.status(201).json(result.message);
  } catch (err) {
    next(err);
  }
});

// Messages: Delete message (soft-delete)
router.delete('/messages/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const result = await chatService.deleteMessage({ messageId: id, userId });
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
