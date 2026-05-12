'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { Session } from '@/types';
import { HiOutlinePencil, HiOutlineTrash, HiOutlinePlusCircle, HiOutlineXMark, HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import Link from 'next/link';

export default function SessionControlPanel() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', track: '', location: '', startTime: '', endTime: '', day: '1' });

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/sessions');
      setSessions(res.data.sessions);
    } catch { showToast('error', 'Failed to load sessions'); }
  };

  const openCreate = () => { setEditId(null); setForm({ title: '', description: '', track: '', location: '', startTime: '', endTime: '', day: '1' }); setShowModal(true); };
  const openEdit = (s: Session) => {
    setEditId(s.id);
    setForm({
      title: s.title, description: s.description || '', track: s.track || '', location: s.location || '',
      startTime: new Date(s.startTime).toISOString().slice(0, 16), endTime: new Date(s.endTime).toISOString().slice(0, 16), day: String(s.day),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, day: parseInt(form.day), startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() };
      if (editId) await apiClient.put(`/sessions/${editId}`, payload);
      else await apiClient.post('/sessions', payload);
      showToast('success', editId ? 'Session updated' : 'Session created');
      setShowModal(false);
      fetchSessions();
    } catch (err: any) { showToast('error', err.response?.data?.error || 'Failed'); }
  };

  const toggleActive = async (s: Session) => {
    try { await apiClient.patch(`/sessions/${s.id}/toggle`); fetchSessions(); }
    catch { showToast('error', 'Failed to toggle'); }
  };

  const deleteSession = async (s: Session) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    try { await apiClient.delete(`/sessions/${s.id}`); showToast('success', 'Deleted'); fetchSessions(); }
    catch { showToast('error', 'Failed to delete'); }
  };

  const moveSession = async (s: Session, direction: 'up' | 'down') => {
    const idx = sessions.findIndex(x => x.id === s.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sessions.length) return;
    try {
      await apiClient.put('/sessions/reorder/batch', { orders: [
        { id: s.id, order: sessions[swapIdx].order },
        { id: sessions[swapIdx].id, order: s.order },
      ]});
      fetchSessions();
    } catch { showToast('error', 'Failed to reorder'); }
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          <HiOutlinePlusCircle size={18} /> Add Session
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sessions.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '16px', borderRadius: '12px', border: s.isActive ? '2px solid #059669' : '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button onClick={() => moveSession(s, 'up')} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: i === 0 ? 0.3 : 1 }}><HiOutlineChevronUp size={16} /></button>
              <button onClick={() => moveSession(s, 'down')} disabled={i === sessions.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: i === sessions.length - 1 ? 0.3 : 1 }}><HiOutlineChevronDown size={16} /></button>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{s.title}</span>
                {s.isActive && <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: '#ECFDF5', color: '#059669' }}>LIVE</span>}
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>Day {s.day}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{fmtTime(s.startTime)} - {fmtTime(s.endTime)} {s.location && `| ${s.location}`}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: s.isActive ? '#059669' : '#64748B' }}>
                <input type="checkbox" checked={s.isActive} onChange={() => toggleActive(s)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Active
              </label>
              <Link 
                href={`/admin?tab=live-qa&session=${s.id}`} 
                title="Moderate Questions (Admin View)"
                style={{ padding: '6px', background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', color: '#2563EB', display: 'flex', alignItems: 'center' }}
              >
                <HiOutlineChatBubbleLeftRight size={16} />
              </Link>
              <button onClick={() => openEdit(s)} style={{ padding: '6px', background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer' }}><HiOutlinePencil size={16} /></button>
              <button onClick={() => deleteSession(s)} style={{ padding: '6px', background: 'none', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', color: '#DC2626' }}><HiOutlineTrash size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{editId ? 'Edit Session' : 'New Session'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><HiOutlineXMark size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Track</label><input value={form.track} onChange={e => setForm({ ...form, track: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Start Time</label><input type="datetime-local" required value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>End Time</label><input type="datetime-local" required value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Day</label><select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }}><option value="1">Day 1</option><option value="2">Day 2</option></select></div>
              <div style={{ gridColumn: 'span 2' }}><button type="submit" style={{ width: '100%', padding: '12px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>{editId ? 'Save Changes' : 'Create Session'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
