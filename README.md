# Real-Time Chat Application

A modern, production-grade real-time chat application built with **React**, **Node.js**, **Express.js**, **WebSockets (Socket.io)**, and **MongoDB (Mongoose)**.

---

## 💡 Why MongoDB vs. PostgreSQL for Chat Applications?

When designing a real-time messaging system, choosing between a Document database (MongoDB) and a Relational database (PostgreSQL) is a fundamental architectural decision.

### Comparison Table

| Criteria | MongoDB (Chosen) | PostgreSQL |
| :--- | :--- | :--- |
| **Data Structure** | **Native Document (JSON/BSON)**: A message contains its text, sender, status, embedded read receipts array `[{ user, readAt }]`, and deletion flags in a single document. | **Relational Tables**: Requires `messages`, `users`, and separate join tables like `message_read_receipts`, requiring multi-table SQL joins per query. |
| **Write Performance** | **High Concurrency & Append-Optimized**: Chat apps are write-heavy streams of continuous messages. MongoDB handles high append-only writes with minimal locking overhead. | **Rigid Locking**: Write throughput on large tables with multiple indexes requires careful connection pooling (e.g. PgBouncer) and partitioning. |
| **Schema Evolution** | **Flexible**: Adding reactions (👍, ❤️), rich attachments, audio notes, or reply-to quotes can be done instantly without schema migrations. | **Rigid**: Any new column or metadata format requires database migrations, table locks, or using JSONB columns. |
| **Sharding & Scaling** | **Horizontal Sharding Out of the Box**: Easy to shard message collections by `conversationId`. | **Complex Horizontal Scaling**: Requires extensions like Citus or read replicas. |
| **Local Environment** | **Active & Running**: MongoDB is already installed and running as a service on your machine. | **Not Installed**: Neither PostgreSQL nor Docker was present. |

---

## ✨ Features Implemented

1. **Real-Time Messaging with WebSockets**:
   - Bi-directional, low-latency socket communication via Socket.io.
   - Conversation-based rooms (`conversationId`).

2. **Timestamps**:
   - Clean, relative and absolute timestamps on every message (`10:45 AM`, `Today`, `Yesterday`, `Last seen 5m ago`).

3. **Read Receipts**:
   - **Single Check (`✓`)**: Message sent to server.
   - **Double Gray Checks (`✓✓`)**: Message delivered to recipient.
   - **Double Blue Checks (`✓✓`)**: Recipient has opened and read the conversation.

4. **Typing Indicators**:
   - Real-time animated bubble indicator ("*Alex is typing...*") with 3 bouncing dots.
   - Auto-stops when the user stops typing (1.5-second debounce).

5. **Message Deletion ("Delete for Everyone")**:
   - Sender can hover over their message to trigger the delete popover.
   - Real-time soft-delete: Replaced with `"🚫 This message was deleted"` across all connected clients simultaneously and persisted in MongoDB.

6. **User Presence & Status**:
   - Live green dot for online users and gray dot for offline users.
   - Dynamic "Active now" or "Last seen [relative time]" status.

7. **Instant Multi-User Testing (Profile Switcher)**:
   - Built-in one-click demo profiles (Alex Rivers, Sarah Connor, David Kim, Elena Rostova) and custom handle login.
   - Open two tabs (e.g. Chrome Tab 1 as Alex and Chrome Tab 2 as Sarah) to test real-time chat between two users immediately!

---

## 📁 Project Structure

```
realtime-chat-app/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js            # MongoDB Mongoose connection
│   │   ├── models/
│   │   │   ├── User.js          # User model & presence
│   │   │   ├── Conversation.js  # Conversation & unread counts
│   │   │   └── Message.js       # Message model with receipts & delete status
│   │   ├── routes/
│   │   │   └── api.js           # REST API endpoints
│   │   ├── sockets/
│   │   │   └── chatHandler.js   # Socket.io events (messages, typing, read receipts, delete)
│   │   └── server.js            # Server entrypoint
│   ├── test-socket.js           # Automated end-to-end WebSocket test suite
│   ├── package.json
│   └── .env
└── client/
    ├── src/
    │   ├── context/
    │   │   └── ChatContext.jsx  # Global chat state & WebSocket listeners
    │   ├── components/
    │   │   ├── Sidebar.jsx      # Contact list, search, conversation threads
    │   │   ├── ChatWindow.jsx   # Message bubbles, typing bubble, input, delete action
    │   │   └── UserSwitcherModal.jsx # Quick demo profiles & user authentication
    │   ├── App.jsx
    │   ├── index.css            # Tailwind CSS styling & animations
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 How to Run

### Prerequisites
- Node.js (v18+)
- MongoDB running on `mongodb://127.0.0.1:27017`

### 1. Start the Backend Server
```bash
cd server
npm install
npm run dev
```
The server will start on **`http://localhost:5000`** and log:
```
🚀 Chat Server running on port 5000
📡 WebSocket ready on port 5000
[MongoDB] Connected: 127.0.0.1/realtime_chat_app
```

### 2. Start the React Frontend
In a new terminal:
```bash
cd client
npm install
npm run dev
```
The client will start on **`http://localhost:5173`**.

---

## 🧪 Testing with Two Users

1. Open **`http://localhost:5173`** in your browser.
2. Select **Alex Rivers**.
3. Open a second browser window (or Incognito tab) at **`http://localhost:5173`**.
4. Select **Sarah Connor**.
5. Click **+** in either tab to start a conversation with the other user.
6. Type in Tab 1 $\rightarrow$ Observe the typing indicator in Tab 2 in real-time!
7. Send a message $\rightarrow$ Observe delivery status and read receipts turning to double blue checks.
8. Hover over a sent message in Tab 1 and click the trash can icon $\rightarrow$ Observe the message delete in real-time on both screens.
