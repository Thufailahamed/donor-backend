import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { format } from 'date-fns';

const router = Router();

// Export session data to CSV
router.get('/:sessionId/export', authenticate, requireRole('MODERATOR', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const session: any = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          include: { user: true, upvotes: true, replies: { include: { user: true } } },
          orderBy: { createdAt: 'asc' }
        },
        polls: { include: { options: { include: { userVotes: true } } } },
        feedback: { include: { user: true } },
      }
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    let csvData = `--- QUESTIONS ---\n`;
    csvData += `ID,Type,Status,Author,Time,Upvotes,Text\n`;
    session.questions.filter((q: any) => !q.parentId).forEach((q: any) => {
      csvData += `"${q.id}","Question","${q.status}","${q.user.name.replace(/"/g, '""')}","${format(new Date(q.createdAt), 'yyyy-MM-dd HH:mm:ss')}","${q.upvotes.length}","${q.text.replace(/"/g, '""')}"\n`;
      q.replies.forEach((reply: any) => {
        csvData += `"${reply.id}","Reply","${reply.status}","${reply.user.name.replace(/"/g, '""')}","${format(new Date(reply.createdAt), 'yyyy-MM-dd HH:mm:ss')}","0","${reply.text.replace(/"/g, '""')}"\n`;
      });
    });

    csvData += `\n--- POLLS ---\n`;
    session.polls.forEach((poll: any) => {
      csvData += `Poll: "${poll.question.replace(/"/g, '""')}"\nOption,Votes\n`;
      poll.options.forEach((opt: any) => {
        csvData += `"${opt.text.replace(/"/g, '""')}","${opt.userVotes.length}"\n`;
      });
      csvData += `\n`;
    });

    csvData += `--- FEEDBACK ---\nAuthor,Time,Rating,Comments\n`;
    session.feedback.forEach((f: any) => {
      csvData += `"${f.user.name.replace(/"/g, '""')}","${format(new Date(f.createdAt), 'yyyy-MM-dd HH:mm:ss')}","${f.rating}","${(f.text || '').replace(/"/g, '""')}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=session-${sessionId}-export.csv`);
    return res.status(200).send(csvData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export session data' });
  }
});

// Attendance report CSV
router.get('/report/attendance', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, isGuest: true, createdAt: true,
        _count: { select: { questions: true, feedback: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const accessLogs = await prisma.accessLog.findMany({
      where: { action: 'LOGIN' },
      select: { userId: true, loginAt: true },
      orderBy: { loginAt: 'desc' },
    });

    const lastLoginMap: Record<string, Date> = {};
    accessLogs.forEach((log: any) => {
      if (log.userId && !lastLoginMap[log.userId]) lastLoginMap[log.userId] = log.loginAt;
    });

    let csv = 'Name,Email,Role,Guest,Questions,Feedback,Last Login,Created\n';
    users.forEach((u: any) => {
      const lastLogin = lastLoginMap[u.id] ? format(new Date(lastLoginMap[u.id]), 'yyyy-MM-dd HH:mm:ss') : 'Never';
      csv += `"${u.name.replace(/"/g, '""')}","${u.email || ''}","${u.role}","${u.isGuest}","${u._count.questions}","${u._count.feedback}","${lastLogin}","${format(new Date(u.createdAt), 'yyyy-MM-dd HH:mm:ss')}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export attendance' });
  }
});

// Full analytics CSV
router.get('/report/analytics-full', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      include: { _count: { select: { questions: true, feedback: true, voiceNotes: true } } },
      orderBy: { startTime: 'asc' },
    });

    const [totalQuestions, totalFeedback, totalVoiceNotes, totalUsers] = await Promise.all([
      prisma.question.count(),
      prisma.feedback.count(),
      prisma.voiceNote.count(),
      prisma.user.count(),
    ]);

    const feedback = await prisma.feedback.findMany({ select: { rating: true } });
    const avgRating = feedback.length > 0 ? (feedback.reduce((a: number, f: any) => a + f.rating, 0) / feedback.length).toFixed(1) : '0';

    let csv = 'OVERVIEW\n';
    csv += `Total Users,Total Questions,Total Feedback,Total Voice Notes,Avg Rating\n`;
    csv += `${totalUsers},${totalQuestions},${totalFeedback},${totalVoiceNotes},${avgRating}\n\n`;

    csv += 'PER-SESSION BREAKDOWN\n';
    csv += `Session,Questions,Feedback,Voice Notes\n`;
    sessions.forEach((s: any) => {
      csv += `"${s.title.replace(/"/g, '""')}","${s._count.questions}","${s._count.feedback}","${s._count.voiceNotes}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics-full-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Q&A transcript for a session
router.get('/report/qa-transcript/:sessionId', authenticate, requireRole('ADMIN', 'MODERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const questions = await prisma.question.findMany({
      where: { sessionId, parentId: null },
      include: {
        user: { select: { name: true } },
        replies: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
        _count: { select: { upvotes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let csv = `Q&A Transcript: ${session.title}\n\n`;
    csv += 'Time,Author,Status,Upvotes,Question,Notes\n';
    questions.forEach((q: any) => {
      csv += `"${format(new Date(q.createdAt), 'HH:mm:ss')}","${q.user.name.replace(/"/g, '""')}","${q.status}","${q._count.upvotes}","${q.text.replace(/"/g, '""')}","${(q.moderatorNotes || '').replace(/"/g, '""')}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=qa-transcript-${sessionId}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export Q&A transcript' });
  }
});

export default router;
