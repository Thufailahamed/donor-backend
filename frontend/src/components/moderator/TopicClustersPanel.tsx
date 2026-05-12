'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { HiOutlineSparkles, HiOutlineTag } from 'react-icons/hi2';

interface Cluster {
  label: string;
  emoji: string;
  questionIds: string[];
}

interface TopicClustersPanelProps {
  sessionId?: string;
  onSelectCluster?: (ids: string[]) => void;
}

export default function TopicClustersPanel({ sessionId, onSelectCluster }: TopicClustersPanelProps) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClusters = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/ai/session/${sessionId}/clusters`);
      setClusters(res.data.clusters);
    } catch (error) {
      console.error('Failed to fetch clusters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
    // Refresh every 30 seconds for live sessions
    const interval = setInterval(fetchClusters, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HiOutlineSparkles size={24} style={{ color: '#8B5CF6' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>AI Topic Insights</h3>
        </div>
        <button 
          onClick={fetchClusters}
          disabled={loading}
          style={{
            background: 'none', border: '1px solid #E2E8F0', borderRadius: '20px',
            padding: '4px 12px', fontSize: '12px', fontWeight: 600, color: '#64748B',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          {loading ? 'Analyzing...' : 'Refresh AI'}
        </button>
      </div>

      {clusters.length === 0 && !loading && (
        <p style={{ fontSize: '14px', color: '#64748B', textAlign: 'center', padding: '10px' }}>
          Not enough questions yet for AI analysis.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {clusters.map((cluster, i) => (
          <button
            key={i}
            onClick={() => onSelectCluster?.(cluster.questionIds)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', border: '1px solid #E2E8F0',
              background: '#F8FAFC', cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#8B5CF6')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
          >
            <span style={{ fontSize: '20px' }}>{cluster.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>{cluster.label}</div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                {cluster.questionIds.length} Questions
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94A3B8' }}>
        <HiOutlineTag size={12} />
        <span>Topics are automatically clustered based on audience sentiment.</span>
      </div>
    </div>
  );
}
