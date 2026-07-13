import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import path from 'path';
import authRoutes from './routes/auth.routes';
import friendRoutes from './routes/friend.routes';
import conversationRoutes from './routes/conversation.routes';
import { decryptUserId } from './config/token';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'audio/webm');
    }
  }
}));
app.use(express.json());

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const PgSession = connectPgSimple(session);

// Session middleware
app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-do-not-use-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Bearer Token session extraction middleware
app.use((req: any, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userId = decryptUserId(token);
    if (userId) {
      if (!req.session) {
        req.session = {} as any;
      }
      req.session.userId = userId;
    }
  }
  next();
});

import http from 'http';
import { Server } from 'socket.io';
import { setupSocketIO } from './socket';

// Initialize HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

setupSocketIO(io);
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/friend', friendRoutes);
app.use('/api/conversation', conversationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
