# Backend Architecture & API / WebSocket Reference

This is a backend-focused real-time messaging server engineered with **Node.js**, **Express.js**, **Socket.io**, and **MongoDB (Mongoose)**.

---

## 🏗️ Architecture Design

```
server/
├── src/
│   ├── config/
│   │   └── db.js               # MongoDB Mongoose connection handler
│   ├── models/
│   │   ├── User.js             # User identity, online state, lastSeen
│   │   ├── Conversation.js     # Chat thread, participants, unread map
│   │   └── Message.js          # Messages, delivery status, read receipts, soft-delete
│   ├── services/
│   │   └── chatService.js      # Core domain business logic (independent of transport)
│   ├── sockets/
│   │   └── chatHandler.js      # Socket.io event router & WebSocket lifecycle
│   ├── routes/
│   │   └── api.js              # Express REST endpoints
│   ├── middlewares/
│   │   └── errorHandler.js     # Centralized error formatting
│   └── server.js               # HTTP + Socket.io server bootstrap
├── test-socket.js              # Automated end-to-end WebSocket integration suite
└── API_DOCS.md                 # Complete API documentation (this document)
```

---

## 🗄️ Database Schemas (MongoDB / Mongoose)

### 1. `User` Schema
Tracks identity, active socket connection, and online presence:
```javascript
{
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  avatar: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: { type: String, default: null }
}
```

### 2. `Conversation` Schema
Tracks 1-on-1 or group conversation metadata and per-user unread counts:
```javascript
{
  participants: [{ type: ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  name: { type: String, default: '' },
  lastMessage: {
    text: { type: String, default: '' },
    sender: { type: ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false }
  },
  unreadCounts: { type: Map, of: Number, default: {} },
  timestamps: true
}
```

### 3. `Message` Schema
Tracks message content, delivery status, read receipts, and soft deletion:
```javascript
{
  conversationId: { type: ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readBy: [{
    user: { type: ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  timestamps: true
}
```

---

## 🔄 Real-Time WebSocket Event Contract

### Client $\rightarrow$ Server Events

| Event | Payload | Acknowledgment Callback | Description |
| :--- | :--- | :--- | :--- |
| `user:online` | `{ userId }` | None | Registers socket ID and broadcasts user's online status to all clients. |
| `conversation:join` | `{ conversationId, userId }` | `({ success: true, conversationId })` | Joins socket room and automatically marks unread messages as read. |
| `conversation:leave` | `{ conversationId }` | None | Leaves conversation room. |
| `message:send` | `{ conversationId, senderId, text }` | `({ success: true, message })` or `({ error })` | Persists message to MongoDB, calculates initial status (`sent` or `delivered`), and broadcasts to room. |
| `message:delete` | `{ messageId, conversationId, userId }` | `({ success: true })` or `({ error })` | Verifies sender ownership, soft-deletes in DB, and broadcasts `message:deleted`. |
| `messages:mark_read` | `{ conversationId, userId }` | None | Marks all unread messages as read in DB, resets unread count, and emits `messages:read`. |
| `typing:start` | `{ conversationId, userId, displayName }` | None | Broadcasts typing indicator to conversation room (excluding sender). |
| `typing:stop` | `{ conversationId, userId }` | None | Broadcasts stopped typing event to conversation room. |

### Server $\rightarrow$ Client Events

| Event | Payload | Target | Description |
| :--- | :--- | :--- | :--- |
| `message:new` | `{ conversationId, message }` | Conversation Room | Fired when a new message is saved. |
| `message:deleted` | `{ conversationId, messageId, text: "This message was deleted" }` | Conversation Room | Fired when a message is soft-deleted. |
| `messages:read` | `{ conversationId, messageIds, readByUserId, readAt }` | Conversation Room | Fired when messages are read (turns ticks to double blue). |
| `typing:status` | `{ conversationId, userId, displayName, isTyping }` | Conversation Room | Fired when a participant starts or stops typing. |
| `user:status_changed` | `{ userId, isOnline, lastSeen }` | Broadcast to all clients | Fired when user presence changes. |
| `conversation:updated` | `{ conversationId, lastMessage }` | Direct User Room (`user:${userId}`) | Keeps conversation list and unread badges updated in real-time. |

---

## 📡 REST API Endpoints

### 1. Authentication
* **`POST /api/auth/login-or-register`**
  * **Body**: `{ "username": "alice", "displayName": "Alice Smith" }`
  * **Response**: `{ "success": true, "user": { ... } }`

### 2. Users
* **`GET /api/users?currentUserId=<id>`**
  * Returns all users with online status, sorted by active presence.
* **`POST /api/users/seed`**
  * Seeds demo users (Alex, Sarah, David, Elena) if database is empty.

### 3. Conversations
* **`GET /api/conversations?userId=<id>`**
  * Returns user's conversations with populated participants and unread counters.
* **`POST /api/conversations`**
  * **Body**: `{ "participantIds": ["id1", "id2"], "isGroup": false, "name": "" }`
  * Returns existing 1-on-1 conversation or creates a new one.

### 4. Messages
* **`GET /api/conversations/:id/messages?limit=50&before=<ISO_DATE>`**
  * Returns paginated message history.
* **`POST /api/conversations/:id/messages`**
  * HTTP fallback to send a message.
  * **Body**: `{ "senderId": "id1", "text": "Hello" }`
* **`DELETE /api/messages/:id`**
  * HTTP fallback to soft-delete a message.
  * **Body**: `{ "userId": "id1" }`

---

## 🧪 Automated Testing

Run the automated integration test script:
```bash
node test-socket.js
```
Validates the entire real-time lifecycle:
1. Health check & user setup
2. Socket connections
3. Room join acknowledgment
4. Real-time typing indicators
5. Message dispatch & delivery ticks
6. Read receipts (double blue ticks)
7. Message deletion ("Delete for everyone")
