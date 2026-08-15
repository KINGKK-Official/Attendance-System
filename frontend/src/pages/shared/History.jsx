import { Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const roleHistoryData = {
  ADMIN: [
    { id: 1, action: "Student Enrolled", entity: "John Doe (ID: 1004)", timestamp: "10 mins ago", status: "Success" },
    { id: 2, action: "New Faculty Registered", entity: "Dr. Sarah Ahmed (sarah@gmail.com)", timestamp: "35 mins ago", status: "Success" },
    { id: 3, action: "Bulk Upload Students", entity: "24_Fall_CS.csv", timestamp: "2 hours ago", status: "Success" },
    { id: 4, action: "System Configuration Updated", entity: "Admin Config Block", timestamp: "5 hours ago", status: "Warning" },
    { id: 5, action: "User Role Revoked", entity: "Test Account (test@gmail.com)", timestamp: "1 day ago", status: "Success" },
  ],
  FACULTY: [
    { id: 1, action: "Attendance Session Started", entity: "Course CSC-101 (Section A)", timestamp: "5 mins ago", status: "Success" },
    { id: 2, action: "Attendance Session Completed", entity: "Course CSC-101 (Section A)", timestamp: "45 mins ago", status: "Success" },
    { id: 3, action: "Manual Attendance Override", entity: "Jane Smith (ID: 1005) - Marked Present", timestamp: "2 hours ago", status: "Success" },
    { id: 4, action: "Monthly Report Exported", entity: "CSC-101_October_Attendance.pdf", timestamp: "1 day ago", status: "Success" },
    { id: 5, action: "Schedule Viewed", entity: "Weekly timetable lookup", timestamp: "2 days ago", status: "Success" },
  ],
  IT_MANAGER: [
    { id: 1, action: "Camera Connection Tested", entity: "Classroom DCT (IP: 192.168.68.53)", timestamp: "2 mins ago", status: "Success" },
    { id: 2, action: "Camera IP Updated", entity: "Classroom DCT - IP changed to 192.168.68.53", timestamp: "15 mins ago", status: "Success" },
    { id: 3, action: "PTZ Preset Saved", entity: "Classroom 104 - Preset 'Whiteboard'", timestamp: "1 hour ago", status: "Success" },
    { id: 4, action: "Audio Consent Gate Configured", entity: "Classroom 102 - Consent set to TRUE", timestamp: "4 hours ago", status: "Success" },
    { id: 5, action: "API Server Connection Check", entity: "Server Status: Healthy", timestamp: "1 day ago", status: "Success" },
  ],
  STUDENT: [
    { id: 1, action: "Attendance Marked", entity: "Course CSC-101 (Section A) - Present", timestamp: "45 mins ago", status: "Success" },
    { id: 2, action: "Biometric Setup Verification", entity: "SFace model embedding validated", timestamp: "2 hours ago", status: "Success" },
    { id: 3, action: "Spoof Alert Notification", entity: "System Warning - Passive LBP validation", timestamp: "1 day ago", status: "Warning" },
    { id: 4, action: "Consensus Finalization Audit", entity: "Double-hit agreement checked", timestamp: "2 days ago", status: "Success" },
  ],
  HOD: [
    { id: 1, action: "At-Risk Reports Reviewed", entity: "CS Department Warning List", timestamp: "10 mins ago", status: "Success" },
    { id: 2, action: "Faculty Attendance Summary Downloaded", entity: "Fall 2026 summary report", timestamp: "2 hours ago", status: "Success" },
  ],
  DEAN: [
    { id: 1, action: "Academic Dashboard Exported", entity: "University wide statistics summary", timestamp: "3 hours ago", status: "Success" },
    { id: 2, action: "Critical Threshold Alerts Reviewed", entity: "Courses under 75% average attendance", timestamp: "1 day ago", status: "Warning" },
  ],
  DEFAULT: [
    { id: 1, action: "System Login", entity: "User Member", timestamp: "10 mins ago", status: "Success" },
    { id: 2, action: "Dashboard Accessed", entity: "Overview page load", timestamp: "45 mins ago", status: "Success" },
    { id: 3, action: "Profile Settings Checked", entity: "Account configuration", timestamp: "2 hours ago", status: "Success" },
  ]
};

const History = () => {
  const { user } = useAuth();
  const role = user?.role || 'DEFAULT';
  const historyData = roleHistoryData[role] || roleHistoryData.DEFAULT;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px' }}>System History</h1>
        <p style={{ color: 'var(--text-muted)' }}>A log of recent activities and system events for your role ({role}).</p>
      </div>

      <div className="glass-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-muted)' }}>Action</th>
              <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-muted)' }}>Target Entity</th>
              <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px', textAlign: 'left', color: 'var(--text-muted)' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 500 }}>
                    <Clock size={16} color="var(--iqra-gold)" />
                    {item.action}
                  </div>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{item.entity}</td>
                <td style={{ padding: '16px' }}>
                  <span className={`badge ${item.status === 'Success' ? 'badge-success' : 'badge-warning'}`}>
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{item.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;
