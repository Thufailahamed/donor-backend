import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    name: string;
    role: string;
    isGuest: boolean;
    isActive?: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isGuest: true, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth - allows guest or authenticated users
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!JWT_SECRET) { next(); return; }

    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, role: true, isGuest: true, isActive: true },
      });
      if (user && user.isActive !== false) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
