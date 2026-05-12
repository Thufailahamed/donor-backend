'use client';

import { HiOutlineChatBubbleBottomCenterText, HiOutlineBolt } from 'react-icons/hi2';

interface CannedResponsesProps {
  onSelect: (text: string) => void;
}

const RESPONSES = [
  { label: 'Addressing shortly', text: 'Thank you for this insightful question. We will be addressing this shortly in the next segment!' },
  { label: 'Follow up after', text: 'Great point! We might not have time for this on stage, but please find the speaker at the breakout booth after the session.' },
  { label: 'Already covered', text: 'This was briefly touched upon earlier. You can view the session recording later today for the full details!' },
  { label: 'Keep it coming', text: 'Excellent engagement! Keep the questions coming, we love the curiosity.' },
];

export default function CannedResponses({ onSelect }: CannedResponsesProps) {
  return (
    <div style={{
      background: '#F1F5F9',
      padding: '16px',
      borderRadius: '12px',
      marginTop: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <HiOutlineBolt size={16} style={{ color: '#D97706' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Quick Moderator Replies</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {RESPONSES.map((res, i) => (
          <button
            key={i}
            onClick={() => onSelect(res.text)}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1',
              background: '#FFFFFF', fontSize: '12px', fontWeight: 600, color: '#1E293B',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#94A3B8')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
          >
            {res.label}
          </button>
        ))}
      </div>
    </div>
  );
}
