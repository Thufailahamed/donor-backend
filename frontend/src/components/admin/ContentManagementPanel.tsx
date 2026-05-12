'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { Session, Content } from '@/types';
import { HiOutlineDocument, HiOutlinePlusCircle, HiOutlineTrash, HiOutlinePencil, HiOutlineXMark, HiOutlineArrowUpTray } from 'react-icons/hi2';

export default function ContentManagementPanel() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [content, setContent] = useState<Content[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'LINK', url: '', body: '' });

  useEffect(() => {
    apiClient.get('/sessions').then(res => {
      setSessions(res.data.sessions);
      if (res.data.sessions.length > 0) setSelected(res.data.sessions[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (selected) fetchContent(); }, [selected]);

  const fetchContent = async () => {
    try {
      const res = await apiClient.get(`/content/session/${selected}`);
      setContent(res.data.content);
    } catch { showToast('error', 'Failed to load content'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post(`/content/session/${selected}`, form);
      showToast('success', 'Content added');
      setShowModal(false);
      setForm({ title: '', type: 'LINK', url: '', body: '' });
      fetchContent();
    } catch { showToast('error', 'Failed to add content'); }
  };

  const deleteContent = async (c: Content) => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    try { await apiClient.delete(`/content/${c.id}`); showToast('success', 'Deleted'); fetchContent(); }
    catch { showToast('error', 'Failed to delete'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', background: '#fff', flex: 1 }}>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          <HiOutlinePlusCircle size={18} /> Add Content
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {content.map(c => (
          <div key={c.id} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiOutlineDocument size={20} style={{ color: '#2563EB' }} />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{c.title}</span>
              </div>
              <button onClick={() => deleteContent(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><HiOutlineTrash size={16} /></button>
            </div>
            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#475569' }}>{c.type}</span>
            {c.url && <div style={{ marginTop: '8px', fontSize: '12px' }}><a href={c.url} target="_blank" style={{ color: '#2563EB', textDecoration: 'none' }}>{c.url}</a></div>}
            {c.body && <p style={{ marginTop: '8px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{c.body}</p>}
          </div>
        ))}
        {content.length === 0 && <div style={{ gridColumn: 'span 2', padding: '40px', textAlign: 'center', color: '#94A3B8', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>No content for this session</div>}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Add Content</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><HiOutlineXMark size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }}><option value="LINK">Link</option><option value="DOCUMENT">Document</option><option value="NOTE">Note</option><option value="SLIDES">Slides</option></select></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>URL</label><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Body / Notes</label><textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', resize: 'vertical' }} /></div>
              <button type="submit" style={{ padding: '12px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Add Content</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
