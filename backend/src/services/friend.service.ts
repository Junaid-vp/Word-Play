import { prisma } from '../config/db';
import crypto from 'crypto';

export async function generateInviteCode(creatorId: string) {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.inviteCode.create({
    data: {
      creatorId,
      code,
      expiresAt
    }
  });

  return invite;
}

export async function getInviteCode(creatorId: string) {
  return await prisma.inviteCode.findFirst({
    where: {
      creatorId,
      isRevoked: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function revokeInviteCode(creatorId: string, code: string) {
  await prisma.inviteCode.updateMany({
    where: { creatorId, code },
    data: { isRevoked: true }
  });
}

export async function sendFriendRequest(senderId: string, code: string) {
  const invite = await prisma.inviteCode.findUnique({
    where: { code }
  });

  if (!invite || invite.isRevoked || invite.expiresAt < new Date()) {
    throw new Error('Invalid or expired invite code');
  }

  if (invite.creatorId === senderId) {
    throw new Error('Cannot send friend request to yourself');
  }

  const user1 = senderId < invite.creatorId ? senderId : invite.creatorId;
  const user2 = senderId < invite.creatorId ? invite.creatorId : senderId;

  const existingFriend = await prisma.friendship.findUnique({
    where: { user1Id_user2Id: { user1Id: user1, user2Id: user2 } }
  });

  if (existingFriend) {
    throw new Error('Already friends');
  }

  const existingReq = await prisma.friendRequest.findFirst({
    where: {
      senderId,
      receiverId: invite.creatorId,
      status: 'PENDING'
    }
  });

  if (existingReq) {
    throw new Error('Friend request already sent');
  }

  return await prisma.friendRequest.create({
    data: {
      senderId,
      receiverId: invite.creatorId,
      inviteCodeId: invite.id
    }
  });
}

export async function respondToFriendRequest(receiverId: string, requestId: string | bigint, accept: boolean) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: BigInt(requestId) }
  });

  if (!request || request.receiverId !== receiverId || request.status !== 'PENDING') {
    throw new Error('Invalid friend request');
  }

  await prisma.friendRequest.update({
    where: { id: BigInt(requestId) },
    data: { status: accept ? 'ACCEPTED' : 'REJECTED' }
  });

  if (accept) {
    const user1 = request.senderId < request.receiverId ? request.senderId : request.receiverId;
    const user2 = request.senderId < request.receiverId ? request.receiverId : request.senderId;

    await prisma.friendship.create({
      data: {
        user1Id: user1,
        user2Id: user2
      }
    });
  }

  return { success: true };
}

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    },
    include: {
      user1: { select: { id: true, privateAlias: true, name: true } },
      user2: { select: { id: true, privateAlias: true, name: true } }
    }
  });

  return friendships.map(f => {
    return f.user1Id === userId ? f.user2 : f.user1;
  });
}

export async function getPendingRequests(userId: string) {
  return await prisma.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: 'PENDING'
    },
    include: {
      sender: { select: { id: true, privateAlias: true, name: true } }
    }
  });
}
