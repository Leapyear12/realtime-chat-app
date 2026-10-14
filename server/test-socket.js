const http = require('http');
const { io: ioClient } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('🧪 [TEST] Starting automated WebSocket & Chat test suite...\n');

  try {
    // 1. Check server health
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 1. Server health check passed:', health.data);

    // 2. Register/Login Alice and Bob
    const aliceRes = await axios.post(`${BASE_URL}/api/auth/login-or-register`, {
      username: 'alice_test',
      displayName: 'Alice (Test User)',
    });
    const alice = aliceRes.data.user;
    console.log('✅ 2a. Alice created/logged in:', alice.displayName, `(${alice._id})`);

    const bobRes = await axios.post(`${BASE_URL}/api/auth/login-or-register`, {
      username: 'bob_test',
      displayName: 'Bob (Test User)',
    });
    const bob = bobRes.data.user;
    console.log('✅ 2b. Bob created/logged in:', bob.displayName, `(${bob._id})`);

    // 3. Create conversation between Alice and Bob
    const convRes = await axios.post(`${BASE_URL}/api/conversations`, {
      participantIds: [alice._id, bob._id],
    });
    const conversation = convRes.data;
    console.log('✅ 3. Conversation established:', conversation._id);

    // 4. Connect WebSockets for Alice and Bob
    const aliceSocket = ioClient(BASE_URL);
    const bobSocket = ioClient(BASE_URL);

    await new Promise((resolve) => {
      let joined = 0;
      const checkJoin = () => {
        joined++;
        if (joined === 2) resolve();
      };

      aliceSocket.on('connect', () => {
        console.log('📡 Alice WebSocket connected');
        aliceSocket.emit('user:online', { userId: alice._id });
        aliceSocket.emit('conversation:join', { conversationId: conversation._id, userId: alice._id }, () => {
          console.log('✅ Alice joined room acknowledged');
          checkJoin();
        });
      });

      bobSocket.on('connect', () => {
        console.log('📡 Bob WebSocket connected');
        bobSocket.emit('user:online', { userId: bob._id });
        bobSocket.emit('conversation:join', { conversationId: conversation._id, userId: bob._id }, () => {
          console.log('✅ Bob joined room acknowledged');
          checkJoin();
        });
      });
    });

    // 5. Test Typing Indicator (Alice types -> Bob receives)
    console.log('\n--- Testing Typing Indicator ---');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Typing status timeout')), 5000);

      bobSocket.on('typing:status', (data) => {
        if (data.userId === alice._id && data.isTyping) {
          console.log(`✅ 5. Bob received typing indicator from ${data.displayName} ("typing...")`);
          clearTimeout(timeout);
          resolve();
        }
      });

      aliceSocket.emit('typing:start', {
        conversationId: conversation._id,
        userId: alice._id,
        displayName: alice.displayName,
      });
    });

    // 6. Test Message Send & Delivery (Alice sends -> Bob receives)
    console.log('\n--- Testing Real-Time Message Dispatch ---');
    let sentMessageId = null;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Message send timeout')), 5000);

      bobSocket.on('message:new', ({ message }) => {
        console.log(`✅ 6. Bob received new message: "${message.text}" (Status: ${message.status})`);
        sentMessageId = message._id;
        clearTimeout(timeout);
        resolve();
      });

      aliceSocket.emit('message:send', {
        conversationId: conversation._id,
        senderId: alice._id,
        text: 'Hey Bob, this is a real-time message via WebSockets!',
      });
    });

    // 7. Test Read Receipts (Bob marks message as read -> Alice receives read receipt)
    console.log('\n--- Testing Read Receipts ---');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Read receipt timeout')), 5000);

      aliceSocket.on('messages:read', ({ messageIds, readByUserId }) => {
        if (messageIds.includes(sentMessageId)) {
          console.log(`✅ 7. Alice received read receipt: message marked READ by user ${readByUserId} (Double Blue Ticks)`);
          clearTimeout(timeout);
          resolve();
        }
      });

      bobSocket.emit('messages:mark_read', {
        conversationId: conversation._id,
        userId: bob._id,
      });
    });

    // 8. Test Message Deletion (Alice deletes -> Bob receives real-time delete event)
    console.log('\n--- Testing Message Deletion (Delete for Everyone) ---');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Delete message timeout')), 5000);

      bobSocket.on('message:deleted', ({ messageId, text }) => {
        if (messageId === sentMessageId) {
          console.log(`✅ 8. Bob received real-time deletion update: "${text}"`);
          clearTimeout(timeout);
          resolve();
        }
      });

      aliceSocket.emit('message:delete', {
        messageId: sentMessageId,
        conversationId: conversation._id,
        userId: alice._id,
      });
    });

    console.log('\n🎉 ALL REAL-TIME TESTS PASSED SUCCESSFULLY!\n');

    // Clean up
    aliceSocket.disconnect();
    bobSocket.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

// Give server 1 second to accept connections then execute
setTimeout(runTest, 1000);
