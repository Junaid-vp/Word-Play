import { Request, Response } from 'express';
import { registerUser, loginUser, recoverUser } from '../services/auth.service';
import { z } from 'zod';
import { prisma } from '../config/db';

const registerSchema = z.object({
  privateAlias: z.string().min(3).max(30),
  name: z.string().min(2).max(50).optional(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  privateAlias: z.string(),
  password: z.string(),
});

const recoverSchema = z.object({
  privateAlias: z.string(),
  recoveryKey: z.string(),
  newPassword: z.string().min(8).max(100),
});

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export async function handleRegister(req: Request, res: Response) {
  try {
    const { privateAlias, password, name } = registerSchema.parse(req.body);
    const { user, recoveryKey } = await registerUser(privateAlias, password, name);
    req.session.userId = user.id;
    res.status(201).json({ user, recoveryKey });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const { privateAlias, password } = loginSchema.parse(req.body);
    const user = await loginUser(privateAlias, password);
    req.session.userId = user.id;
    res.json({ user });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

export async function handleRecover(req: Request, res: Response) {
  try {
    const { privateAlias, recoveryKey, newPassword } = recoverSchema.parse(req.body);
    const { recoveryKey: newRecoveryKey } = await recoverUser(privateAlias, recoveryKey, newPassword);
    req.session.destroy(() => {});
    res.json({ message: 'Password updated', newRecoveryKey });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

export function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
}

export async function handleMe(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, privateAlias: true, name: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleUnlock(req: Request, res: Response) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    const secret = process.env.UNLOCK_SECRET || 'sfvnpp23';
    if (code.trim() === secret.trim()) {
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Invalid secret code' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
