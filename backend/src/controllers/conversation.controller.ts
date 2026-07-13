import { Request, Response } from 'express';
import { 
  createConversation as makeConversation, 
  getConversations as fetchConversations, 
  getMessages as fetchMessages,
  saveVoiceMessage,
  deleteConversation as removeConversation
} from '../services/conversation.service';
import { z } from 'zod';

export async function handleCreateConversation(req: Request, res: Response) {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string() }).parse(req.body);
    const conv = await makeConversation(req.session.userId!, targetUserId);
    res.json(conv);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleGetConversations(req: Request, res: Response) {
  try {
    const convs = await fetchConversations(req.session.userId!);
    res.json(convs);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleGetMessages(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { cursor } = req.query;
    
    const cursorStr = typeof cursor === 'string' ? cursor : undefined;
    const msgs = await fetchMessages(req.session.userId!, id as string, cursorStr);
    
    res.json(msgs);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleUploadVoice(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;
    const { duration } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const durationInt = parseInt(duration, 10) || 0;
    const msg = await saveVoiceMessage(req.session.userId!, id as string, file.filename, durationInt);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${id}`).emit('message:new', msg);
    }
    
    res.json(msg);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function handleDeleteConversation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await removeConversation(req.session.userId!, id as string);
    res.json({ message: 'Conversation deleted' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
