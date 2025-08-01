import React, { useEffect, useState } from 'react';
import { useMultiplayer } from '../lib/stores/useMultiplayer';
import { useGameState } from '../lib/stores/useGameState';

interface LeaderboardEntry {
  username: string;
  gold: number;
  population: number;
  territory: number;
  score: number;
}

const Leaderboard: React.FC = () => {
  const { getLeaderboard } = useMultiplayer();
  const { gameTime } = useGameState();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const data = await getLeaderboard();
      if (data) {
        setLeaderboardData(data);
      }
    };

    // Fetch leaderboard initially and then every 5 seconds
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);

    return () => clearInterval(interval);
  }, [getLeaderboard, gameTime]); // Re-fetch when gameTime updates (roughly every 5s on server)

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '250px',
      maxHeight: '300px',
      overflowY: 'auto',
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', textAlign: 'center' }}>🏆 Leaderboard</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>#</th>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>Player</th>
            <th style={{ textAlign: 'right', padding: '4px 0' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '8px 0' }}>No players yet</td>
            </tr>
          ) : (
            leaderboardData.map((entry, index) => (
              <tr key={entry.username} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '4px 0' }}>{index + 1}</td>
                <td style={{ padding: '4px 0' }}>{entry.username}</td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{entry.score.toFixed(0)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;


