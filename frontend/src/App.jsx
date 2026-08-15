import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import StudentEnrollment from './pages/admin/StudentEnrollment';
import CourseManagement from './pages/admin/CourseManagement';
import AcademicEnrollment from './pages/admin/AcademicEnrollment';
import CourseList from './pages/faculty/CourseList';
import AttendanceSession from './pages/faculty/AttendanceSession';
import Reports from './pages/faculty/Reports';
import BulkUpload from './pages/admin/BulkUpload';
import HodDashboard from './pages/HodDashboard';
import DeanDashboard from './pages/DeanDashboard';
import CameraSetup from './pages/it_manager/CameraSetup';
import SystemSettings from './pages/it_manager/SystemSettings';
import ItManagerDashboard from './pages/it_manager/ItManagerDashboard';
import AttendanceDashboard from './pages/student/AttendanceDashboard';
import NotificationInbox from './pages/student/NotificationInbox';
import AuditView from './pages/student/AuditView';
import History from './pages/shared/History';
import Analytics from './pages/shared/Analytics';
import { 
  LayoutDashboard, Users, UserPlus, TrendingUp, BookOpen, 
  Calendar, Video, Settings, Bell, HelpCircle, Search, LogOut 
} from 'lucide-react';

const ProtectedRoute = ({ children, role, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

const Layout = ({ children }) => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isAdminDashboardArea = user?.role === 'ADMIN' && (location.pathname === '/admin/dashboard' || location.pathname === '/admin/history' || location.pathname === '/admin/analytics');
  const isFacultyDashboardArea = user?.role === 'FACULTY' && (location.pathname === '/faculty/courses' || location.pathname === '/faculty/history' || location.pathname === '/faculty/analytics');
  const isDashboardArea = isAdminDashboardArea || isFacultyDashboardArea;


  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Stitch Dark Sidebar */}
      <div className="sidebar" style={{ width: '260px', backgroundColor: 'var(--iqra-blue)', color: 'white', display: 'flex', flexDirection: 'column', borderRight: 'none' }}>
        <div className="sidebar-header" style={{ padding: '24px 32px', backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏫</div>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AI Attendance System</p>
        </div>
        
        <nav className="sidebar-nav" style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {user.role === 'ADMIN' && (
            <>
              <NavLink to="/admin/dashboard" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> <span>Dashboard</span>
              </NavLink>
              <NavLink to="/admin/users" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Users size={20} style={{ marginRight: '12px' }} /> <span>Faculty Directory</span>
              </NavLink>
              <NavLink to="/admin/students" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <UserPlus size={20} style={{ marginRight: '12px' }} /> <span>Enrollment</span>
              </NavLink>
              <NavLink to="/admin/academic" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <BookOpen size={20} style={{ marginRight: '12px' }} /> <span>Academic Enrollment</span>
              </NavLink>
              <NavLink to="/admin/courses" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <BookOpen size={20} style={{ marginRight: '12px' }} /> <span>Courses</span>
              </NavLink>
            </>
          )}

          {user.role === 'FACULTY' && (
            <>
              <NavLink to="/faculty/courses" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Calendar size={20} style={{ marginRight: '12px' }} /> <span>Daily Schedule</span>
              </NavLink>
              <NavLink to="/faculty/reports" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <BookOpen size={20} style={{ marginRight: '12px' }} /> <span>My Courses</span>
              </NavLink>
            </>
          )}

          {user.role === 'IT_MANAGER' && (
            <>
              <NavLink to="/it-manager/dashboard" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> <span>IT Dashboard</span>
              </NavLink>
            </>
          )}

          {user.role === 'STUDENT' && (
            <>
              <NavLink to="/student/dashboard" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> <span>My Attendance</span>
              </NavLink>
              <NavLink to="/student/notifications" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Bell size={20} style={{ marginRight: '12px' }} /> <span>Notifications</span>
              </NavLink>
            </>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ padding: '0 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>System Status: Active</span>
            </div>
            <div className="nav-link" style={{ cursor: 'pointer' }} onClick={() => alert('Settings panel opened!')}>
              <Settings size={20} style={{ marginRight: '12px' }} /> <span>Settings</span>
            </div>
            <div className="nav-link" style={{ cursor: 'pointer' }} onClick={logout}>
              <LogOut size={20} style={{ marginRight: '12px' }} /> <span>Logout</span>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '260px', padding: 0 }}>
        
        {/* Stitch Top Header */}
        <header style={{ height: '72px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
              {user.role === 'ADMIN' ? 'Administrator Portal' : user.role === 'FACULTY' ? 'Faculty Portal' : 'General Portal'}
            </h2>
            {/* Mock Navigation Tabs - Only show on relevant dashboard/overview pages */}
            {(user.role === 'ADMIN' || user.role === 'FACULTY') && isDashboardArea && (
              <div style={{ display: 'flex', gap: '24px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>
                <NavLink 
                  to={user.role === 'ADMIN' ? "/admin/dashboard" : "/faculty/courses"} 
                  className={({isActive}) => isActive ? "active-tab" : ""}
                  style={({isActive}) => isActive ? { color: 'var(--text-main)', borderBottom: '2px solid var(--text-main)', paddingBottom: '24px', marginBottom: '-24px', textDecoration: 'none' } : { cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                >
                  Overview
                </NavLink>
                <NavLink 
                  to={user.role === 'ADMIN' ? "/admin/history" : "/faculty/history"} 
                  className={({isActive}) => isActive ? "active-tab" : ""}
                  style={({isActive}) => isActive ? { color: 'var(--text-main)', borderBottom: '2px solid var(--text-main)', paddingBottom: '24px', marginBottom: '-24px', textDecoration: 'none' } : { cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                >
                  History
                </NavLink>
                <NavLink 
                  to={user.role === 'ADMIN' ? "/admin/analytics" : "/faculty/analytics"} 
                  className={({isActive}) => isActive ? "active-tab" : ""}
                  style={({isActive}) => isActive ? { color: 'var(--text-main)', borderBottom: '2px solid var(--text-main)', paddingBottom: '24px', marginBottom: '-24px', textDecoration: 'none' } : { cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                >
                  Analytics
                </NavLink>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search student records..." style={{ padding: '10px 16px 10px 36px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--bg-main)', fontSize: '14px', width: '280px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>
              <Bell size={20} />
              <HelpCircle size={20} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{user.full_name || 'User'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user.role}</div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--iqra-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--iqra-blue)' }}>
                {user.full_name ? user.full_name.charAt(0) : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <div style={{ padding: '40px' }}>
                  <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Welcome, {JSON.parse(localStorage.getItem('user') || '{}')?.full_name}</h1>
                  <p style={{ color: '#64748B' }}>Academic AI Attendance System — {new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}</p>
                  
                  <div className="glass-card" style={{ marginTop: '40px', borderLeft: '6px solid var(--iqra-gold)' }}>
                    <h3>System Overview</h3>
                    <p style={{ marginTop: '10px', color: '#475569' }}>
                      Please select a module from the sidebar to manage university records, enroll students, or track attendance.
                    </p>
                  </div>
                </div>
              </Layout>
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute role="ADMIN"><Layout><AdminDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute role="ADMIN"><Layout><UserManagement /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoute role="ADMIN"><Layout><StudentEnrollment /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/academic" element={
            <ProtectedRoute role="ADMIN"><Layout><AcademicEnrollment /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/courses" element={
            <ProtectedRoute role="ADMIN"><Layout><CourseManagement /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/history" element={
            <ProtectedRoute role="ADMIN"><Layout><History /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute role="ADMIN"><Layout><Analytics /></Layout></ProtectedRoute>
          } />

          {/* Faculty Routes */}
          <Route path="/faculty/courses" element={
            <ProtectedRoute role="FACULTY"><Layout><CourseList /></Layout></ProtectedRoute>
          } />
          <Route path="/faculty/sessions/:sessionId" element={
            <ProtectedRoute role="FACULTY"><Layout><AttendanceSession /></Layout></ProtectedRoute>
          } />
          <Route path="/faculty/reports" element={
            <ProtectedRoute role="FACULTY"><Layout><Reports /></Layout></ProtectedRoute>
          } />
          <Route path="/faculty/history" element={
            <ProtectedRoute role="FACULTY"><Layout><History /></Layout></ProtectedRoute>
          } />
          <Route path="/faculty/analytics" element={
            <ProtectedRoute role="FACULTY"><Layout><Analytics /></Layout></ProtectedRoute>
          } />

          {/* Admin extra routes */}
          <Route path="/admin/bulk-upload" element={
            <ProtectedRoute role="ADMIN"><Layout><BulkUpload /></Layout></ProtectedRoute>
          } />

          {/* Leadership Dashboard (HOD and Associate Dean) */}
          <Route path="/hod/dashboard" element={
            <ProtectedRoute allowedRoles={['HOD', 'ASSOCIATE_DEAN']}><Layout><HodDashboard /></Layout></ProtectedRoute>
          } />

          {/* DEAN Routes */}
          <Route path="/dean/dashboard" element={
            <ProtectedRoute role="DEAN"><Layout><DeanDashboard /></Layout></ProtectedRoute>
          } />

          {/* IT Manager Routes */}
          <Route path="/it-manager/dashboard" element={
            <ProtectedRoute role="IT_MANAGER"><Layout><ItManagerDashboard /></Layout></ProtectedRoute>
          } />
          
          <Route path="/it-manager/camera-setup" element={<Navigate to="/it-manager/dashboard" />} />
          <Route path="/it-manager/settings" element={<Navigate to="/it-manager/dashboard" />} />

          {/* Student Routes (Task 10) — role guard checks JWT-derived role === 'STUDENT' */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute role="STUDENT"><Layout><AttendanceDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/student/notifications" element={
            <ProtectedRoute role="STUDENT"><Layout><NotificationInbox /></Layout></ProtectedRoute>
          } />
          <Route path="/student/audit" element={
            <ProtectedRoute role="STUDENT"><Layout><AuditView /></Layout></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
