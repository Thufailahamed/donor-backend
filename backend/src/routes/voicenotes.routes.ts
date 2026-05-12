import { Router, Response } from 'express';
import { prisma } from "../lib/prisma";
import { io } from "../server";
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { uploadVoiceNote } from '../middleware/upload.middleware';
import { broadcastToSession } from '../services/socket.service';
import { uploadToAzure, deleteFromAzure } from '../services/azure-storage.service';
import fs from 'fs';

const router = Router();

// Upload a voice note
router.post(
  '/session/:sessionId',
  authenticate,
  uploadVoiceNote.single('audio'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
        const duration = req.body.duration as string;

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      let audioUrl = `/uploads/voicenotes/${req.file.filename}`;

      try {
        // Try to upload to Azure if configured
        const azureUrl = await uploadToAzure(req.file.path, req.file.originalname);
        audioUrl = azureUrl;
        
        // Cleanup local file after successful Azure upload
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Failed to delete local file after Azure upload:', err);
        });
      } catch (azureError: any) {
        console.warn('Azure upload failed, falling back to local storage:', azureError.message);
        // Fallback is already set in audioUrl
      }

      const voiceNote = await prisma.voiceNote.create({
        data: {
          audioUrl,
          duration: parseInt(duration) || 0,
          sessionId: sessionId as string,
          userId: req.user!.id,
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      broadcastToSession(io, sessionId as string, 'new-voicenote', voiceNote);

      res.status(201).json({ voiceNote });
    } catch (error) {
      console.error('Upload voice note error:', error);
      res.status(500).json({ error: 'Failed to upload voice note' });
    }
  }
);

// List voice notes for a session
router.get('/session/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const voiceNotes = await prisma.voiceNote.findMany({
      where: { sessionId: req.params.sessionId as string },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ voiceNotes });
  } catch (error) {
    console.error('List voice notes error:', error);
    res.status(500).json({ error: 'Failed to fetch voice notes' });
  }
});

// Delete a voice note
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: req.params.id as string }
    });
    
    if (!voiceNote) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    if (voiceNote.userId !== req.user!.id && !['MODERATOR', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.voiceNote.delete({
      where: { id: req.params.id as string }
    });

    // Cleanup from Azure if applicable
    if (voiceNote.audioUrl.includes('blob.core.windows.net')) {
      deleteFromAzure(voiceNote.audioUrl).catch(err => console.error('Failed to delete from Azure:', err));
    }

    broadcastToSession(io, voiceNote.sessionId, 'voicenote-deleted', { voiceNoteId: voiceNote.id });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete voice note error:', error);
    res.status(500).json({ error: 'Failed to delete voice note' });
  }
});

export default router;
