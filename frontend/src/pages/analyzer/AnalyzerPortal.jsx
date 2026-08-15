import { useState, useEffect } from 'react';
import api from '../../api';

const AnalyzerPortal = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>Loading Sentiment Analytics...</div>;
  }

  const mockSentimentData = [
    { course: 'CS-401', date: '2026-07-09', positive: 45, neutral: 40, distracted: 15 },
    { course: 'EE-201', date: '2026-07-09', positive: 30, neutral: 50, distracted: 20 },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: 'var(--iqra-gold)' }}>Sentiment Analyzer Portal</h1>
      <p style={{ color: 'var(--text-muted)' }}>Aggregate engagement metrics (Anonymized)</p>

      <div className="glass-card" style={{ padding: '24px', marginTop: '32px' }}>
        <h3>Recent Session Sentiments</h3>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '8px' }}>Course</th>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Positive</th>
              <th style={{ padding: '8px' }}>Neutral</th>
              <th style={{ padding: '8px' }}>Distracted</th>
            </tr>
          </thead>
          <tbody>
            {mockSentimentData.map((data, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{data.course}</td>
                <td style={{ padding: '8px' }}>{data.date}</td>
                <td style={{ padding: '8px', color: 'green' }}>{data.positive}%</td>
                <td style={{ padding: '8px', color: 'gray' }}>{data.neutral}%</td>
                <td style={{ padding: '8px', color: 'red' }}>{data.distracted}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalyzerPortal;
