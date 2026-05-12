// ============================================================
// IDES Shared TypeScript Types
// ============================================================

export type Role = 'PARTICIPANT' | 'SPEAKER' | 'MODERATOR' | 'ADMIN';
export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'HIGHLIGHTED' | 'DISMISSED' | 'ANALYZING';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  isGuest: boolean;
  avatarUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface Session {
  id: string;
  title: string;
  description?: string | null;
  objectives?: string | null;
  track?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  order: number;
  day: number;
  speakers: SessionSpeaker[];
  _count?: {
    questions: number;
    feedback: number;
    voiceNotes?: number;
  };
}

export interface SessionSpeaker {
  id: string;
  role: string;
  speaker: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role?: string;
  };
}

export interface Question {
  id: string;
  text: string;
  status: QuestionStatus;
  sessionId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    isGuest: boolean;
  };
  upvoteCount: number;
  hasUpvoted: boolean;
  isPinned?: boolean;
  isFlagged?: boolean;
  moderatorNotes?: string | null;
  parentId?: string | null;
  isSimilarMerge?: boolean;
  isAdminHighlighted?: boolean;
  replies?: Question[];
}

export interface Feedback {
  id: string;
  rating: number;
  text?: string | null;
  type: string;
  sessionId?: string | null;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

export interface VoiceNote {
  id: string;
  audioUrl: string;
  duration: number;
  transcript?: string | null;
  sessionId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

export interface Content {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  body?: string | null;
  sessionId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface EngagementMetrics {
  overview: {
    totalQuestions: number;
    totalFeedback: number;
    totalVoiceNotes: number;
    totalUsers: number;
  };
  sessions: {
    id: string;
    title: string;
    questions: number;
    feedback: number;
    voiceNotes: number;
  }[];
}

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  average: number;
  total: number;
}

export interface TopicData {
  word: string;
  count: number;
}

// ============================================================
// New types for Admin & Moderator improvements
// ============================================================

export interface AccessLog {
  id: string;
  userId?: string | null;
  name: string;
  role?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  action: string;
  loginAt: string;
  logoutAt?: string | null;
  sessionId?: string | null;
}

export interface AccessLogStats {
  totalLogins: number;
  uniqueUsers: number;
  byDevice: Record<string, number>;
  byRole: Record<string, number>;
}

export interface OnlineUser {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  sessionId?: string;
}

export interface OnlineUsersData {
  onlineCount: number;
  peakConcurrent: number;
  users: OnlineUser[];
  sessions: { sessionId: string; sessionTitle: string; count: number }[];
}

export interface ActivityLogEntry {
  id: string;
  userId?: string | null;
  userName: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  sessionId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface ModeratorActionLogEntry {
  id: string;
  moderatorId: string;
  moderatorName: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  sessionId?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface FlaggedContentItem {
  id: string;
  questionId: string;
  reason: string;
  severity: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  question?: Question;
}

export interface EngagementScore {
  userId: string;
  userName: string;
  role: string;
  score: number;
  breakdown: {
    questionsAsked: number;
    upvotesReceived: number;
    feedbackGiven: number;
    pollVotes: number;
  };
}

export interface SystemHealth {
  status: string;
  uptime: number;
  timestamp: string;
  api: {
    avgResponseTimeMs: number;
    requestsPerMinute: number;
    errorRate: number;
    totalRequests: number;
    totalErrors: number;
  };
  socket: {
    connectedUsers: number;
    peakConcurrent: number;
    activeRooms: number;
  };
  database: {
    status: string;
    latencyMs: number;
  };
}

export interface TimeSeriesPoint {
  time: string;
  count: number;
}

export interface EngagementTimelinePoint {
  time: string;
  questions: number;
  upvotes: number;
  feedback: number;
}

export interface BroadcastNotification {
  title: string;
  message: string;
  type: string;
}

export interface SessionFeedbackStats {
  sessionId: string;
  sessionTitle: string;
  averageRating: number;
  totalResponses: number;
  positive: number;
  neutral: number;
  negative: number;
}
