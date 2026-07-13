import { Request, Response } from 'express';
import { 
  getInviteCode as getInvite, 
  generateInviteCode as genInvite, 
  revokeInviteCode as revInvite, 
  sendFriendRequest as sendReq, 
  respondToFriendRequest as respondReq, 
  getFriends as getFriendsList, 
  getPendingRequests as getPendingReqs 
} from '../services/friend.service';
import { z } from 'zod';
import { prisma } from '../config/db';

export async function handleGetInviteCode(req: Request, res: Response) {
  try {
    const invite = await getInvite(req.session.userId!);
    if (!invite) {
      const newInvite = await genInvite(req.session.userId!);
      return res.json({ ...newInvite, id: newInvite.id.toString() });
    }
    res.json({ ...invite, id: invite.id.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleGenerateInviteCode(req: Request, res: Response) {
  try {
    const invite = await genInvite(req.session.userId!);
    res.json({ ...invite, id: invite.id.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleRevokeInviteCode(req: Request, res: Response) {
  try {
    const { code } = req.body;
    await revInvite(req.session.userId!, code);
    res.json({ message: 'Revoked' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleSendFriendRequest(req: Request, res: Response) {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const reqRes = await sendReq(req.session.userId!, code);

    // Emit socket event to the receiver for real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${reqRes.receiverId}`).emit('friend:request');
    }

    res.json({ message: 'Request sent', id: reqRes.id.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleRespondToFriendRequest(req: Request, res: Response) {
  try {
    const { requestId, accept } = z.object({ requestId: z.string(), accept: z.boolean() }).parse(req.body);

    // Find the request details before responding to notify both parties in real-time
    const friendReq = await prisma.friendRequest.findUnique({
      where: { id: BigInt(requestId) }
    });

    await respondReq(req.session.userId!, requestId, accept);

    const io = req.app.get('io');
    if (io && friendReq) {
      if (accept) {
        io.to(`user:${friendReq.senderId}`).emit('friend:accepted');
        io.to(`user:${friendReq.receiverId}`).emit('friend:accepted');
      } else {
        io.to(`user:${friendReq.senderId}`).emit('friend:declined');
      }
    }

    res.json({ message: 'Responded' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleGetFriends(req: Request, res: Response) {
  try {
    const friends = await getFriendsList(req.session.userId!);
    res.json(friends);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleGetPendingRequests(req: Request, res: Response) {
  try {
    const requests = await getPendingReqs(req.session.userId!);
    res.json(requests.map(r => ({ ...r, id: r.id.toString(), inviteCodeId: r.inviteCodeId.toString() })));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
