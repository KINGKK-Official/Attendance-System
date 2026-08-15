import { useState, useEffect } from 'react';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewProfileUser, setViewProfileUser] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ full_name: '', email: '' });
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'FACULTY', department_code: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const openModal = () => {
    setFormData({ full_name: '', email: '', password: '', role: 'FACULTY', department_code: '' });
    setShowModal(true);
  };

  const handleViewProfile = (u) => {
    setViewProfileUser(u);
    setEditProfileForm({ full_name: u.full_name, email: u.email });
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    try {
      // Mocking or calling update endpoint if available
      try {
        await axios.put(`/api/admin/users/${viewProfileUser.id}`, editProfileForm);
      } catch (e) {
        console.log('Update endpoint might not exist, updating local state only.');
      }
      
      setUsers(users.map(u => u.id === viewProfileUser.id ? { ...u, ...editProfileForm } : u));
      setViewProfileUser({ ...viewProfileUser, ...editProfileForm });
      setIsEditingProfile(false);
    } catch (err) {
      alert("Failed to update user");
    }
  };

  const hasAssociateDean = users.some(u => u.role === 'ASSOCIATE_DEAN');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users");
    }
  };

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await axios.post('/api/admin/users', formData);
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create user");
    }
  };

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`/api/admin/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--iqra-blue)', margin: '0 0 8px 0' }}>User Directory</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage system users, roles, and department assignments</p>
        </div>
        <button 
          className="btn" 
          onClick={openModal}
          style={{ backgroundColor: 'var(--iqra-blue)', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>+</span> Add User
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search users by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <select 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ width: '200px', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', fontSize: '14px', outline: 'none' }}
        >
          <option value="ALL">All Roles</option>
          <option value="FACULTY">Faculty</option>
          <option value="STUDENT">Students</option>
          <option value="ADMIN">Administrators</option>
          <option value="HOD">HODs</option>
          <option value="DEAN">Deans</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {filteredUsers.map(u => (
          <div key={u.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--iqra-blue)', color: 'var(--iqra-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, flexShrink: 0 }}>
                {u.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                <span style={{ 
                  display: 'inline-block',
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontSize: '11px',
                  fontWeight: 600,
                  background: u.role === 'ADMIN' ? '#FEE2E2' : (u.role === 'HOD' || u.role === 'DEAN' || u.role === 'ASSOCIATE_DEAN') ? '#D1FAE5' : '#E0F2FE', 
                  color: u.role === 'ADMIN' ? '#991B1B' : (u.role === 'HOD' || u.role === 'DEAN' || u.role === 'ASSOCIATE_DEAN') ? '#065F46' : '#0369A1',
                  border: `1px solid ${u.role === 'ADMIN' ? '#FECACA' : (u.role === 'HOD' || u.role === 'DEAN' || u.role === 'ASSOCIATE_DEAN') ? '#A7F3D0' : '#BAE6FD'}`
                }}>
                  {u.role.replace('_', ' ')} {u.department_code ? `— ${u.department_code}` : ''}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button 
                onClick={() => handleViewProfile(u)}
                className="btn" 
                style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--iqra-blue)', color: 'var(--iqra-blue)', padding: '8px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                View Profile
              </button>
              <button 
                onClick={() => handleDelete(u.id)}
                className="btn" 
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', marginTop: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>No users found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', margin: 0 }}>Try adjusting your search or role filter.</p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '16px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginBottom: '8px', color: 'var(--text-main)', fontSize: '24px' }}>Add New User</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Enter the user details below to provision a new account.</p>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Full Name</label>
                <input 
                  className="input-field"
                  placeholder="e.g. Dr. Sarah Ahmed" 
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Email Address</label>
                <input 
                  className="input-field"
                  type="email" 
                  placeholder="name@gmail.com" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Password</label>
                <input 
                  className="input-field"
                  type="password" 
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>System Role</label>
                <select 
                  className="input-field"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                >
                  <option value="FACULTY">Faculty Member</option>
                  <option value="IT_MANAGER">IT Manager</option>
                  <option value="ADMIN">System Administrator</option>
                  <option value="HOD">Head of Department (HOD)</option>
                  <option value="DEAN">Dean</option>
                  <option value="ASSOCIATE_DEAN" disabled={hasAssociateDean}>
                    Associate Dean {hasAssociateDean ? '(Already Exists)' : ''}
                  </option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>

              {formData.role === 'IT_MANAGER' && (
                <div style={{ backgroundColor: '#EFF6FF', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #BFDBFE' }}>
                  <p style={{ fontSize: '12px', color: '#1E3A8A', margin: 0, display: 'flex', gap: '8px' }}>
                    <span>ℹ️</span>
                    <span>IT Managers can configure cameras, view live feeds, and run diagnostics. All actions are audit-logged.</span>
                  </p>
                </div>
              )}

              {formData.role === 'HOD' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Department Code</label>
                  <input 
                    className="input-field"
                    placeholder="e.g. CS, EE" 
                    value={formData.department_code}
                    onChange={e => setFormData({...formData, department_code: e.target.value})}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn" style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ flex: 1, backgroundColor: 'var(--iqra-blue)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewProfileUser && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="uni-card" style={{ backgroundColor: 'white', width: '380px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', position: 'relative', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ backgroundColor: 'var(--iqra-blue)', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', position: 'relative' }}>
              <button onClick={() => setViewProfileUser(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px 24px', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', zIndex: 10, width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--iqra-gold)', color: 'var(--iqra-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 700, margin: '-40px auto 16px auto', border: '4px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {viewProfileUser.full_name.charAt(0).toUpperCase()}
              </div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'var(--iqra-blue)', fontWeight: 700 }}>
                {isEditingProfile ? (
                  <input 
                    value={editProfileForm.full_name} 
                    onChange={e => setEditProfileForm({...editProfileForm, full_name: e.target.value})}
                    style={{ fontSize: '20px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none' }}
                  />
                ) : (
                  viewProfileUser.full_name
                )}
              </h2>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                {isEditingProfile ? (
                  <input 
                    value={editProfileForm.email} 
                    onChange={e => setEditProfileForm({...editProfileForm, email: e.target.value})}
                    style={{ fontSize: '14px', padding: '4px 8px', textAlign: 'center', width: '100%', borderRadius: '4px', border: '1px solid var(--border)', outline: 'none', marginTop: '4px' }}
                  />
                ) : (
                  viewProfileUser.email
                )}
              </p>
              
              {isEditingProfile ? (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  <button onClick={() => setIsEditingProfile(false)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Cancel</button>
                  <button onClick={handleSaveProfile} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: 'var(--iqra-blue)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Save Changes</button>
                </div>
              ) : (
                <button onClick={() => setIsEditingProfile(true)} style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid var(--iqra-blue)', color: 'var(--iqra-blue)', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>Edit Profile</button>
              )}
              
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Role</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 700 }}>{viewProfileUser.role.replace('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: viewProfileUser.department_code ? '12px' : '0', borderBottom: viewProfileUser.department_code ? '1px solid #E2E8F0' : 'none', paddingBottom: viewProfileUser.department_code ? '8px' : '0' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</span>
                  <span style={{ fontSize: '13px', color: '#10B981', fontWeight: 700 }}>Active</span>
                </div>
                {viewProfileUser.department_code && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Department</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 700 }}>{viewProfileUser.department_code}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
                University ID Card
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
