import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db';

export function setupSocketIO(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    let userId: string | null = null;

    socket.on('auth', async (data: { userId: string }) => {
      userId = data.userId;
      socket.join(`user:${userId}`);
      console.log(`User ${userId} authenticated on socket ${socket.id}`);
      socket.broadcast.emit('presence:update', { userId, status: 'online' });
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

      io.to(`conversation:${data.conversationId}`).emit('message:new', {
        ...msg,
        clientId: data.clientId
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

    socket.on('conversation:delete', (data: { conversationId: string }) => {
      io.to(`conversation:${data.conversationId}`).emit('conversation:deleted', { conversationId: data.conversationId });
    });

    socket.on('disconnect', () => {
      if (userId) {
        socket.broadcast.emit('presence:update', { userId, status: 'offline' });
      }
      console.log('Client disconnected:', socket.id);
    });
  });
}
