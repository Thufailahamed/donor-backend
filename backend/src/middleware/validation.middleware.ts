import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: errors });
    }
    req.body = result.data;
    next();
  };
};

export const sanitizeText = (str: string, maxLength: number = 1000): string => {
  return xss(str.trim().slice(0, maxLength));
};

export const schemas = {
  guestLogin: z.object({
    name: z.string().min(2).max(100).transform(v => v.trim()),
  }),

  login: z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(255),
  }),

  register: z.object({
    email: z.string().email().max(255),
    password: z.string().min(6).max(255),
    name: z.string().min(2).max(100).transform(v => v.trim()),
    role: z.enum(['PARTICIPANT', 'SPEAKER', 'MODERATOR', 'ADMIN']).optional(),
  }),

  submitQuestion: z.object({
    text: z.string().min(3).max(1000).transform(v => v.trim()),
    parentId: z.string().uuid().optional().nullable(),
  }),

  submitFeedback: z.object({
    rating: z.number().int().min(1).max(5),
    text: z.string().max(2000).optional().transform(v => v?.trim() || undefined),
    type: z.enum(['session', 'overall']).optional(),
  }),

  updateQuestionStatus: z.object({
    status: z.enum(['PENDING', 'ANSWERED', 'HIGHLIGHTED', 'DISMISSED']),
  }),

  createSession: z.object({
    title: z.string().min(1).max(300).transform(v => v.trim()),
    description: z.string().max(2000).optional().transform(v => v?.trim() || undefined),
    objectives: z.string().max(2000).optional().transform(v => v?.trim() || undefined),
    track: z.string().max(100).optional().transform(v => v?.trim() || undefined),
    location: z.string().max(200).optional().transform(v => v?.trim() || undefined),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    order: z.number().int().min(0).optional(),
    day: z.number().int().min(1).optional(),
    speakerIds: z.array(z.string().uuid()).optional(),
  }),

  updateSession: z.object({
    title: z.string().min(1).max(300).optional().transform(v => v?.trim()),
    description: z.string().max(2000).optional().transform(v => v?.trim()),
    objectives: z.string().max(2000).optional().transform(v => v?.trim()),
    track: z.string().max(100).optional().transform(v => v?.trim()),
    location: z.string().max(200).optional().transform(v => v?.trim()),
    startTime: z.string().datetime({ offset: true }).optional(),
    endTime: z.string().datetime({ offset: true }).optional(),
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
    day: z.number().int().min(1).optional(),
  }),
};
