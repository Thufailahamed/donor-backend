'use client';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { User } from '@/types';
import { HiOutlineMagnifyingGlass, HiOutlinePencil, HiOutlineTrash, HiOutlineLockClosed, HiOutlinePlusCircle, HiOutlineXMark, HiOutlineNoSymbol, HiOutlineCheckCircle } from 'react-icons/hi2';

export default function UserManagementPanel() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'reset'>('create');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'PARTICIPANT' });

  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page: String(page), limit: '15' };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await apiClient.get('/users', { params });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch { showToast('error', 'Failed to load users'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setModalMode('create'); setEditUser(null); setForm({ name: '', email: '', password: '', role: 'PARTICIPANT' }); setShowModal(true); };
  const openEdit = (u: User) => { setModalMode('edit'); setEditUser(u); setForm({ name: u.name, email: u.email || '', password: '', role: u.role }); setShowModal(true); };
  const openReset = (u: User) => { setModalMode('reset'); setEditUser(u); setForm({ name: '', email: '', password: '', role: '' }); setShowModal(true); };

  const handleSubmit = async () => {
    try {
      if (modalMode === 'create') {
        await apiClient.post('/users', form);
        showToast('success', 'User created');
      } else if (modalMode === 'edit' && editUser) {
        await apiClient.put(`/users/${editUser.id}`, { name: form.name, email: form.email, role: form.role });
        showToast('success', 'User updated');
      } else if (modalMode === 'reset' && editUser) {
        await apiClient.put(`/users/${editUser.id}/reset-password`, { password: form.password });
        showToast('success', 'Password reset');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) { showToast('error', err.response?.data?.error || 'Operation failed'); }
  };

  const toggleActive = async (u: User) => {
    try {
      await apiClient.put(`/users/${u.id}/${u.isActive === false ? 'activate' : 'deactivate'}`);
      showToast('success', `User ${u.isActive === false ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch { showToast('error', 'Failed to update'); }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    try {
      await apiClient.delete(`/users/${u.id}`);
      showToast('success', 'User deleted');
      fetchUsers();
    } catch { showToast('error', 'Failed to delete'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <HiOutlineMagnifyingGlass size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers()} placeholder="Search users..." style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px' }} />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} style={{ padding: '10px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option><option value="MODERATOR">Moderator</option>
          <option value="SPEAKER">Speaker</option><option value="PARTICIPANT">Participant</option>
        </select>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          <HiOutlinePlusCircle size={18} /> Add User
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
              {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#F8FAFC' : '#fff' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{u.name} {u.isGuest && <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(guest)</span>}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B' }}>{u.email || '-'}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5' }}>{u.role}</span></td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: u.isActive === false ? '#DC2626' : '#059669' }}>
                    {u.isActive === false ? <><HiOutlineNoSymbol size={14} /> Inactive</> : <><HiOutlineCheckCircle size={14} /> Active</>}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#94A3B8' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEdit(u)} title="Edit" style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><HiOutlinePencil size={16} /></button>
                    <button onClick={() => toggleActive(u)} title={u.isActive === false ? 'Activate' : 'Deactivate'} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: u.isActive === false ? '#059669' : '#D97706' }}><HiOutlineNoSymbol size={16} /></button>
                    <button onClick={() => openReset(u)} title="Reset Password" style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><HiOutlineLockClosed size={16} /></button>
                    <button onClick={() => deleteUser(u)} title="Delete" style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><HiOutlineTrash size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', opacity: page === 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: '8px 16px', fontWeight: 600, fontSize: '13px' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{modalMode === 'create' ? 'Add User' : modalMode === 'edit' ? 'Edit User' : 'Reset Password'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><HiOutlineXMark size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {modalMode !== 'reset' && <>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>
                <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Role</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }}><option value="PARTICIPANT">Participant</option><option value="SPEAKER">Speaker</option><option value="MODERATOR">Moderator</option><option value="ADMIN">Admin</option></select></div>
              </>}
              {(modalMode === 'create' || modalMode === 'reset') && <div><label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Password</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} /></div>}
              <button onClick={handleSubmit} style={{ padding: '12px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>{modalMode === 'create' ? 'Create User' : modalMode === 'edit' ? 'Save Changes' : 'Reset Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
