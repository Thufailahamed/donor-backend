import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import multer from 'multer';
import path from 'path';
import { uploadToAzure, deleteFromAzure } from '../services/azure-storage.service';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/materials/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const uploadMaterial = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

// List content for a session
router.get('/session/:sessionId', async (req, res: Response) => {
  try {
    const content = await prisma.content.findMany({
      where: { sessionId: req.params.sessionId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Create content (link/text)
router.post('/session/:sessionId', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, type, url, body } = req.body;
    const content = await prisma.content.create({
      data: { title, type, url, body, sessionId: req.params.sessionId as string },
    });
    res.status(201).json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Upload content file
router.post('/session/:sessionId/upload', authenticate, requireRole('ADMIN'), uploadMaterial.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let fileUrl = `/uploads/materials/${req.file.filename}`;

    try {
      const azureUrl = await uploadToAzure(req.file.path, req.file.originalname, 'materials');
      fileUrl = azureUrl;
      
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete local material file:', err);
      });
    } catch (azureError: any) {
      console.warn('Azure material upload failed:', azureError.message);
    }

    const content = await prisma.content.create({
      data: {
        title: req.body.title || req.file.originalname,
        type: 'FILE',
        url: fileUrl,
        sessionId: req.params.sessionId as string,
      },
    });
    res.status(201).json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

// Update content
router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, type, url, body } = req.body;
    const content = await prisma.content.update({
      where: { id: req.params.id as string },
      data: { ...(title !== undefined && { title }), ...(type !== undefined && { type }), ...(url !== undefined && { url }), ...(body !== undefined && { body }) },
    });
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: req.params.id as string } });
    
    if (content?.url?.includes('blob.core.windows.net')) {
      deleteFromAzure(content.url).catch(err => console.error('Failed to delete material from Azure:', err));
    }

    await prisma.content.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Content deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

export default router;
