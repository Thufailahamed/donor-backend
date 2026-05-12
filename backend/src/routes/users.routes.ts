import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import bcrypt from 'bcryptjs';

const router = Router();

// List users (paginated, searchable, filterable)
router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, search, isGuest, page = '1', limit = '20' } = req.query;
    const where: any = {};
    if (role) where.role = role as string;
    if (isGuest !== undefined) where.isGuest = isGuest === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, isGuest: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.put('/:id/role', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Generic user update
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Deactivate user
router.put('/:id/deactivate', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Activate user
router.put('/:id/activate', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Reset password
router.put('/:id/reset-password', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { password: hashed },
    });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Create user (admin)
router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, isGuest: false },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Delete user
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { hard } = req.query;
    if (hard === 'true') {
      await prisma.user.delete({ where: { id: req.params.id as string } });
    } else {
      await prisma.user.update({
        where: { id: req.params.id as string },
        data: { isActive: false },
      });
    }
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
