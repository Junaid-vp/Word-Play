import { prisma } from '../config/db';
import argon2 from 'argon2';
import crypto from 'crypto';

export async function registerUser(privateAlias: string, password: string, name?: string) {
  const existing = await prisma.user.findFirst({
    where: {
      privateAlias: {
        equals: privateAlias,
        mode: 'insensitive'
      }
    },
  });
  if (existing) {
    throw new Error('Alias already in use');
  }

  const passwordHash = await argon2.hash(password);
  const recoveryKey = crypto.randomBytes(16).toString('hex');
  const recoveryKeyHash = await argon2.hash(recoveryKey);

  const user = await prisma.user.create({
    data: {
      privateAlias,
      name,
      passwordHash,
      recoveryKeyHash,
    },
  });

  return {
    user: {
      id: user.id,
      privateAlias: user.privateAlias,
      name: user.name,
    },
    recoveryKey,
  };
}

export async function loginUser(privateAlias: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      privateAlias: {
        equals: privateAlias,
        mode: 'insensitive'
      }
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await argon2.verify(user.passwordHash, password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  return {
    id: user.id,
    privateAlias: user.privateAlias,
    name: user.name,
  };
}

export async function recoverUser(privateAlias: string, recoveryKey: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      privateAlias: {
        equals: privateAlias,
        mode: 'insensitive'
      }
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await argon2.verify(user.recoveryKeyHash, recoveryKey);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const newPasswordHash = await argon2.hash(newPassword);
  const newRecoveryKey = crypto.randomBytes(16).toString('hex');
  const newRecoveryKeyHash = await argon2.hash(newRecoveryKey);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      recoveryKeyHash: newRecoveryKeyHash,
    },
  });

  return {
    recoveryKey: newRecoveryKey,
  };
}
