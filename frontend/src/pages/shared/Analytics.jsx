import { TrendingUp, Users, Calendar, CheckCircle } from 'lucide-react';

const mockAnalytics = [
  { title: "Total Enrollments", value: "1,245", trend: "+12% this month", icon: Users, color: "var(--iqra-gold)" },
  { title: "Average Attendance", value: "87%", trend: "+2% from last week", icon: TrendingUp, color: "#10B981" },
  { title: "Active Sessions", value: "34", trend: "Today", icon: Calendar, color: "var(--iqra-blue)" },
  { title: "System Uptime", value: "99.9%", trend: "Last 30 days", icon: CheckCircle, color: "#8B5CF6" },
];

const Analytics = () => {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px' }}>System Analytics</h1>
        <p style={{ color: 'var(--text-muted)' }}>Overview of attendance metrics and system usage.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {mockAnalytics.map((stat, i) => (
          <div key={i} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: `${stat.color}15`, color: stat.color }}>
              <stat.icon size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>{stat.title}</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.trend}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <TrendingUp size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>Interactive Charts Coming Soon</h3>
          <p>Full visual analytics will be available in the next milestone.</p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
