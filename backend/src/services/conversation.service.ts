import { prisma } from '../config/db';
import fs from 'fs';
import path from 'path';

export async function createConversation(user1Id: string, user2Id: string) {
  const isFriend = await prisma.friendship.findUnique({
    where: {
      user1Id_user2Id: {
        user1Id: user1Id < user2Id ? user1Id : user2Id,
        user2Id: user1Id < user2Id ? user2Id : user1Id
      }
    }
  });

  if (!isFriend) {
    throw new Error('Can only start conversations with friends');
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId: user1Id } } },
        { members: { some: { userId: user2Id } } }
      ]
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, privateAlias: true, name: true } }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (existing) {
    return existing;
  }

  return await prisma.conversation.create({
    data: {
      members: {
        create: [
          { userId: user1Id },
          { userId: user2Id }
        ]
      }
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, privateAlias: true, name: true } }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });
}

export async function getConversations(userId: string) {
  return await prisma.conversation.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, privateAlias: true, name: true } }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });
}

export async function getMessages(userId: string, conversationId: string, cursor?: string, take = 50) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });

  if (!member) {
    throw new Error('Not authorized to view these messages');
  }

  return await prisma.message.findMany({
    where: { conversationId },
    take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      receipts: true,
      voiceAttachment: true
    }
  });
}

export async function saveVoiceMessage(userId: string, conversationId: string, storageKey: string, duration: number) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });

  if (!member) {
    throw new Error('Not authorized to send messages here');
  }

  return await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: userId,
        encryptedContent: '[Encrypted Voice]',
        type: 'VOICE'
      }
    });

    const attachment = await tx.voiceAttachment.create({
      data: {
        messageId: msg.id,
        storageKey,
        duration,
        encryptedMetadata: '{}'
      }
    });

    return {
      ...msg,
      voiceAttachment: attachment
    };
  });
}

export async function deleteConversation(userId: string, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });

  if (!member) {
    throw new Error('Not authorized to delete this conversation');
  }

  const voiceAttachments = await prisma.voiceAttachment.findMany({
    where: { message: { conversationId } }
  });

  voiceAttachments.forEach(att => {
    const filePath = path.join(__dirname, '../../uploads', att.storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  await prisma.conversation.delete({
    where: { id: conversationId }
  });

  return { success: true };
}
