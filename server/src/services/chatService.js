const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

class ChatService {
  /**
   * Login or register a user by username
   */
  async loginOrRegisterUser({ username, displayName }) {
    if (!username || !username.trim()) {
      const err = new Error('Username is required');
      err.statusCode = 400;
      throw err;
    }

    const cleanUsername = username.trim().toLowerCase();
    const finalDisplayName = displayName?.trim() || cleanUsername;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`;

    let user = await User.findOne({ username: cleanUsername });
    if (!user) {
      user = new User({
        username: cleanUsername,
        displayName: finalDisplayName,
        avatar,
        isOnline: true,
      });
      await user.save();
    } else {
      user.displayName = finalDisplayName;
      user.isOnline = true;
      await user.save();
    }

    return user;
  }

  /**
   * List all users
   */
  async getAllUsers(excludeUserId = null) {
    const query = excludeUserId ? { _id: { $ne: excludeUserId } } : {};
    return User.find(query).select('-socketId').sort({ isOnline: -1, displayName: 1 });
  }

  /**
   * Update online presence
   */
  async setUserOnlineStatus(userId, isOnline, socketId = null) {
    if (!userId) return null;
    const updateData = { isOnline };
    if (socketId !== undefined) updateData.socketId = socketId;
    if (!isOnline) updateData.lastSeen = new Date();

    return User.findByIdAndUpdate(userId, updateData, { returnDocument: 'after' });
  }

  /**
   * Fetch conversations for a user
   */
  async getUserConversations(userId) {
    if (!userId) {
      const err = new Error('userId is required');
      err.statusCode = 400;
      throw err;
    }

    return Conversation.find({ participants: userId })
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });
  }

  /**
   * Get or create a 1-on-1 or group conversation
   */
  async getOrCreateConversation({ participantIds, isGroup = false, name = '' }) {
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      const err = new Error('At least 2 participant IDs are required');
      err.statusCode = 400;
      throw err;
    }

    // For 1-on-1 chats, check if conversation already exists
    if (!isGroup && participantIds.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participantIds, $size: 2 },
      }).populate('participants', 'username displayName avatar isOnline lastSeen');

      if (existing) return existing;
    }

    const conversation = new Conversation({
      participants: participantIds,
      isGroup,
      name: isGroup ? name || 'Group Chat' : '',
      lastMessage: {
        text: 'Conversation created',
        createdAt: new Date(),
      },
    });

    await conversation.save();
    return Conversation.findById(conversation._id).populate(
      'participants',
      'username displayName avatar isOnline lastSeen'
    );
  }

  /**
   * Fetch messages for a conversation with pagination
   */
  async getConversationMessages(conversationId, { limit = 50, before = null } = {}) {
    const filter = { conversationId };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    return Message.find(filter)
      .populate('sender', 'username displayName avatar isOnline')
      .sort({ createdAt: 1 })
      .limit(parsedLimit);
  }

  /**
   * Send a new message
   */
  async sendMessage({ conversationId, senderId, text }) {
    if (!conversationId || !senderId || !text || !text.trim()) {
      const err = new Error('Missing required message parameters');
      err.statusCode = 400;
      throw err;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    // Determine initial delivery status based on recipient presence
    const otherParticipants = conversation.participants.filter(
      (p) => p.toString() !== senderId.toString()
    );

    let initialStatus = 'sent';
    const onlineOthers = await User.find({
      _id: { $in: otherParticipants },
      isOnline: true,
    });

    if (onlineOthers.length > 0) {
      initialStatus = 'delivered';
    }

    const message = new Message({
      conversationId,
      sender: senderId,
      text: text.trim(),
      status: initialStatus,
      readBy: [],
    });

    await message.save();

    // Update conversation lastMessage & increment unread counts
    const updateFields = {
      lastMessage: {
        text: text.trim(),
        sender: senderId,
        createdAt: message.createdAt,
        isDeleted: false,
      },
    };

    otherParticipants.forEach((pId) => {
      const key = `unreadCounts.${pId.toString()}`;
      const current = (conversation.unreadCounts && conversation.unreadCounts.get(pId.toString())) || 0;
      updateFields[key] = current + 1;
    });

    await Conversation.findByIdAndUpdate(conversationId, { $set: updateFields });

    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'username displayName avatar isOnline'
    );

    return {
      message: populatedMessage,
      conversation,
      otherParticipantIds: otherParticipants.map((p) => p.toString()),
    };
  }

  /**
   * Mark unread messages in a conversation as read
   */
  async markMessagesAsRead({ conversationId, userId }) {
    if (!conversationId || !userId) return { messageIds: [], readAt: null };

    const unreadMessages = await Message.find({
      conversationId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
      isDeleted: false,
    });

    if (unreadMessages.length === 0) {
      return { messageIds: [], readAt: null };
    }

    const now = new Date();
    const messageIds = unreadMessages.map((m) => m._id);

    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $set: { status: 'read' },
        $push: { readBy: { user: userId, readAt: now } },
      }
    );

    // Reset unread count for this user
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCounts.${userId}`]: 0 },
    });

    return { messageIds, readAt: now };
  }

  /**
   * Soft-delete a message
   */
  async deleteMessage({ messageId, userId }) {
    if (!messageId || !userId) {
      const err = new Error('Missing messageId or userId');
      err.statusCode = 400;
      throw err;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    if (message.sender.toString() !== userId.toString()) {
      const err = new Error('Unauthorized to delete this message');
      err.statusCode = 403;
      throw err;
    }

    message.isDeleted = true;
    message.text = 'This message was deleted';
    await message.save();

    // If this was the lastMessage in the conversation, update that too
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation?.lastMessage?.sender?.toString() === userId.toString()) {
      conversation.lastMessage.text = 'This message was deleted';
      conversation.lastMessage.isDeleted = true;
      await conversation.save();
    }

    return {
      message,
      conversationId: message.conversationId.toString(),
      participants: conversation ? conversation.participants.map((p) => p.toString()) : [],
    };
  }
}

module.exports = new ChatService();
