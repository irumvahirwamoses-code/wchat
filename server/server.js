import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import decisionRoutes from './routes/decisionRoutes.js';
import postRoutes from './routes/postRoutes.js';
import storyRoutes from './routes/storyRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { CATEGORIES, FEATURES } from './data/categories.js';
import {
  INTERESTS,
  INTEREST_CATEGORIES,
  MIN_INTERESTS,
  MIN_JOINED_CIRCLES,
} from './data/interests.js';
import { COUNTRIES } from './data/countries.js';
import { ensureStarterCircles } from './services/circles.js';
import { startChatScheduler } from './services/chatScheduler.js';
import User from './models/User.js';
import Chat from './models/Chat.js';
import Message from './models/Message.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
// One or more comma-separated origins, e.g.
// "https://wchat.vercel.app,https://www.wchat.app". `*` allows any origin
// (handy for preview deployments, not recommended for production).
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const CLIENT_ORIGINS = CLIENT_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

// Render/Koyeb terminate TLS in front of the app; trust that proxy so client
// IPs and protocol are reported correctly.
app.set('trust proxy', 1);

// -------------------- Middleware --------------------
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: CLIENT_ORIGINS.includes('*') ? true : CLIENT_ORIGINS,
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static files (uploaded media)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- Public routes --------------------
// Hosting health check (Render/Koyeb ping this to know the service is alive).
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Wchat', uptime: process.uptime() });
});app.get('/api/options', (req, res) => {
  res.json({ categories: CATEGORIES, features: FEATURES });
});

// Interest taxonomy for onboarding ("pick at least 5 fields")
app.get('/api/interests', (req, res) => {
  res.json({
    interests: INTERESTS,
    categories: INTEREST_CATEGORIES,
    minInterests: MIN_INTERESTS,
    minJoinedCircles: MIN_JOINED_CIRCLES,
  });
});

app.get('/api/countries', (req, res) => {
  res.json({ countries: COUNTRIES });
});

// -------------------- API routes --------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// -------------------- Serve the built client (optional) --------------------
// Single-host deployment: `cd client && npm run build` then start the server.
// Express then serves the SPA from the same origin as the API and Socket.IO,
// so there is nothing to configure in CORS and no VITE_API_URL to set.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// -------------------- Central error handler --------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for '${err.path}'`;
  } else if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyValue || { field: 'value' })[0];
    const duplicateMessages = {
      username: 'Username already taken',
      email: 'Email already registered',
      phoneNumber: 'Phone number already in use',
    };
    message = duplicateMessages[field] || `${field} already exists`;
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 25MB)' : err.message;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Not authorized, token failed';
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ message });
});

// -------------------- HTTP + Socket.IO --------------------
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGINS.includes('*') ? true : CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available to controllers via req.app.get('io')
app.set('io', io);

// -------------------- Socket.IO state --------------------
const onlineUsers = new Map(); // userId -> Set of socket ids
const meetings = new Map(); // meetingId -> Map of userId -> name

const broadcastOnlineUsers = () => {
  io.emit('online users', Array.from(onlineUsers.keys()));
};

const trackSocket = (userId, socketId) => {
  if (!userId) return;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

// Returns true when the user has no more active sockets (went fully offline).
const untrackSocket = (userId, socketId) => {
  if (!userId || !onlineUsers.has(userId)) return false;
  const sockets = onlineUsers.get(userId);
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
};

// Socket authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch (error) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;

  socket.join(`user:${userId}`);
  trackSocket(userId, socket.id);

  // Presence: join personal room + mark online
  socket.on('setup', async (setupUserId) => {
    const targetId = userId || setupUserId;
    socket.join(`user:${targetId}`);

    try {
      await User.findByIdAndUpdate(targetId, { isOnline: true, lastSeen: new Date() });
    } catch (error) {
      console.error('setup presence error:', error.message);
    }

    broadcastOnlineUsers();
  });

  // Join a chat room
  socket.on('join chat', (chatId) => {
    if (chatId) socket.join(`chat:${chatId}`);
  });

  // Broadcast a new message to the chat room and notify other members
  socket.on('new message', async (message) => {
    try {
      if (!message || !message.chat) return;

      io.to(`chat:${message.chat}`).emit('message received', message);

      const chat = await Chat.findById(message.chat).select('users chatName').lean();
      if (!chat) return;

      const senderId =
        message.sender && typeof message.sender === 'object'
          ? message.sender._id
          : message.sender;

      let senderName = 'Someone';

      if (message.sender && typeof message.sender === 'object' && message.sender.firstName) {
        senderName = `${message.sender.firstName} ${message.sender.lastName || ''}`.trim();
      } else if (senderId) {
        const sender = await User.findById(senderId).select('firstName lastName').lean();
        if (sender) senderName = `${sender.firstName} ${sender.lastName}`.trim();
      }

      (chat.users || []).forEach((member) => {
        const memberId = String(member._id || member);
        if (memberId !== String(senderId)) {
          io.to(`user:${memberId}`).emit('new message notification', {
            chatId: String(message.chat),
            message,
            senderName,
          });
        }
      });
    } catch (error) {
      console.error('new message socket error:', error.message);
    }
  });

  // Typing indicators
  socket.on('typing', (chatId) => {
    if (chatId) socket.to(`chat:${chatId}`).emit('typing', { chatId, userId });
  });

  socket.on('stop typing', (chatId) => {
    if (chatId) socket.to(`chat:${chatId}`).emit('stop typing', { chatId, userId });
  });

  // Notify a group admin that somebody wants to join
  socket.on('admin notify join request', async (chatId) => {
    try {
      if (!chatId) return;

      const chat = await Chat.findById(chatId).select('chatName groupAdmin').lean();
      if (!chat || !chat.groupAdmin) return;

      const requester = await User.findById(userId)
        .select('firstName lastName username profilePicture')
        .lean();

      io.to(`user:${chat.groupAdmin}`).emit('new join request', {
        chatId: chat._id,
        chatName: chat.chatName,
        user: requester
          ? {
              _id: requester._id,
              firstName: requester.firstName,
              lastName: requester.lastName,
              username: requester.username,
              profilePicture: requester.profilePicture,
            }
          : null,
      });
    } catch (error) {
      console.error('join request socket error:', error.message);
    }
  });

  // Bulk mark chat messages as seen
  socket.on('chat seen', async (payload = {}) => {
    try {
      const { chatId } = payload;
      if (!chatId || !userId) return;

      await Message.updateMany(
        { chat: chatId, sender: { $ne: userId }, seenBy: { $ne: userId } },
        { $addToSet: { seenBy: userId } }
      );

      io.to(`chat:${chatId}`).emit('chat seen', { chatId, userId });
    } catch (error) {
      console.error('chat seen socket error:', error.message);
    }
  });

  // Mark a message as seen
  socket.on('message seen', async (payload = {}) => {
    try {
      const { chatId, messageId } = payload;
      if (!chatId || !messageId) return;

      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { seenBy: userId } },
        { returnDocument: 'after' }
      );

      if (message) {
        io.to(`chat:${chatId}`).emit('message seen', {
          messageId,
          chatId,
          seenBy: message.seenBy,
        });
      }
    } catch (error) {
      console.error('message seen socket error:', error.message);
    }
  });

  // -------- 1-to-1 WebRTC call signaling --------
  socket.on('callUser', ({ to, from, callType, signalData, name } = {}) => {
    if (!to) return;
    io.to(`user:${to}`).emit('incoming call', {
      from: from || userId,
      callType,
      signalData,
      name,
    });
  });

  socket.on('answer call', ({ to, from, signalData } = {}) => {
    if (!to) return;
    io.to(`user:${to}`).emit('call accepted', { from: from || userId, signalData });
  });

  socket.on('reject call', ({ to, from } = {}) => {
    if (!to) return;
    io.to(`user:${to}`).emit('call rejected', { from: from || userId });
  });

  socket.on('end call', ({ to, from } = {}) => {
    if (!to) return;
    io.to(`user:${to}`).emit('call ended', { from: from || userId });
  });

  // -------- Group meeting (mesh WebRTC) --------
  socket.on('join meeting', ({ meetingId, userId: meetingUserId, name } = {}) => {
    if (!meetingId) return;

    const targetId = userId || meetingUserId;
    const displayName = name || targetId;

    socket.join(`meeting:${meetingId}`);

    if (!meetings.has(meetingId)) meetings.set(meetingId, new Map());
    const room = meetings.get(meetingId);

    const peers = Array.from(room.entries())
      .filter(([peerId]) => peerId !== targetId)
      .map(([peerId, peerName]) => ({ userId: peerId, name: peerName }));

    socket.emit('meeting peers', peers);

    peers.forEach((peer) => {
      io.to(`user:${peer.userId}`).emit('meeting peer joined', {
        userId: targetId,
        name: displayName,
      });
    });

    room.set(targetId, displayName);
  });

  socket.on('meeting signal', ({ meetingId, to, from, signal } = {}) => {
    if (!to) return;
    io.to(`user:${to}`).emit('meeting signal', { from: from || userId, signal, meetingId });
  });

  socket.on('leave meeting', ({ meetingId, userId: meetingUserId } = {}) => {
    if (!meetingId) return;

    const targetId = userId || meetingUserId;
    socket.leave(`meeting:${meetingId}`);

    const room = meetings.get(meetingId);
    if (room) {
      room.delete(targetId);
      if (room.size === 0) meetings.delete(meetingId);
    }

    socket.to(`meeting:${meetingId}`).emit('meeting peer left', { userId: targetId });
  });

  // -------- Disconnect --------
  socket.on('disconnect', async () => {
    // Clean up any meetings this socket was part of
    for (const [meetingId, members] of Array.from(meetings)) {
      if (!members.has(userId)) continue;

      const room = io.sockets.adapter.rooms.get(`meeting:${meetingId}`);
      const stillInMeeting =
        room &&
        Array.from(room).some((sid) => {
          if (sid === socket.id) return false;
          const other = io.sockets.sockets.get(sid);
          return other && other.userId === userId;
        });

      if (!stillInMeeting) {
        members.delete(userId);
        io.to(`meeting:${meetingId}`).emit('meeting peer left', { userId });
      }

      if (members.size === 0) meetings.delete(meetingId);
    }

    const wentOffline = untrackSocket(userId, socket.id);

    if (wentOffline) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      } catch (error) {
        console.error('disconnect presence error:', error.message);
      }
    }

    broadcastOnlineUsers();
  });
});

// -------------------- Start --------------------
const startServer = async () => {
  try {
    await connectDB();

    // Make sure the public starter Circles exist (idempotent).
    try {
      const { created, total } = await ensureStarterCircles();
      if (created) console.log(`Wchat: created ${created} starter Circles (${total} total)`);
    } catch (circleError) {
      console.warn(`Could not ensure starter Circles: ${circleError.message}`);
    }

    // Deliver scheduled messages and sweep expired Vanish Mode messages.
    startChatScheduler(io);

    httpServer.listen(PORT, () => {
      console.log(`Wchat server running on http://localhost:${PORT}`);
      console.log(`Socket.IO ready, accepting clients from ${CLIENT_ORIGINS.join(', ')}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export { app, io, httpServer };
