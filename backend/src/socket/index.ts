import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db';
import { decryptUserId } from '../config/token';

export function setupSocketIO(io: Server) {
  // Authentication middleware for Socket.IO connection handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (token) {
      const userId = decryptUserId(token as string);
      if (userId) {
        (socket as any).userId = userId;
        return next();
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    let userId: string | null = (socket as any).userId || null;

    // Automatically join the user notification room if handshake was authenticated
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} pre-authenticated and joined room`);
      socket.broadcast.emit('presence:update', { userId, status: 'online' });
    }

    socket.on('auth', async (data: { userId: string }) => {
      // Backup auth event (in case handshake token auth was not used)
      if (!userId) {
        userId = data.userId;
        socket.join(`user:${userId}`);
        console.log(`User ${userId} authenticated manually on socket ${socket.id}`);
        socket.broadcast.emit('presence:update', { userId, status: 'online' });
      }
    });

    socket.on('conversation:join', async (data: { conversationId: string }) => {
      if (!userId) return;
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } }
      });
      if (member) {
        socket.join(`conversation:${data.conversationId}`);
      }
    });

    socket.on('message:send', async (data: { conversationId: string, encryptedContent: string, type: string, clientId?: string }) => {
      if (!userId) return;
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } }
      });
      if (!member) return;

      const msg = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: userId,
          encryptedContent: data.encryptedContent,
          type: data.type || 'TEXT'
        },
        include: {
          receipts: true,
          voiceAttachment: true
        }
      });

      // Find all conversation members
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: data.conversationId },
        select: { userId: true }
      });

      // Emit new message event to each member's personal user room
      members.forEach(m => {
        io.to(`user:${m.userId}`).emit('message:new', {
          ...msg,
          clientId: data.clientId
        });
      });
    });

    socket.on('message:read', async (data: { messageId: string }) => {
      if (!userId) return;
      try {
        const receipt = await prisma.messageReceipt.upsert({
          where: {
            messageId_userId_status: {
              messageId: data.messageId,
              userId,
              status: 'READ'
            }
          },
          update: {},
          create: {
            messageId: data.messageId,
            userId,
            status: 'READ'
          },
          include: {
            message: true
          }
        });

        // Notify conversation channel of read receipt
        io.to(`conversation:${receipt.message.conversationId}`).emit('message:receipt', {
          messageId: data.messageId,
          userId,
          status: 'READ',
          timestamp: receipt.timestamp
        });
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!userId) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', { conversationId: data.conversationId, userId });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!userId) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', { conversationId: data.conversationId, userId });
    });

    socket.on('conversation:delete', (data: { conversationId: string, memberIds?: string[] }) => {
      if (data.memberIds && Array.isArray(data.memberIds)) {
        data.memberIds.forEach(mId => {
          io.to(`user:${mId}`).emit('conversation:deleted', { conversationId: data.conversationId });
        });
      } else {
        io.to(`conversation:${data.conversationId}`).emit('conversation:deleted', { conversationId: data.conversationId });
      }
    });

    socket.on('disconnect', () => {
      if (userId) {
        socket.broadcast.emit('presence:update', { userId, status: 'offline' });
      }
      console.log('Client disconnected:', socket.id);
    });
  });
}
