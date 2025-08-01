import React, { useEffect } from 'react';
import { useGameState } from '../../lib/stores/useGameState';

const AlertsDisplay: React.FC = () => {
  const { alerts, removeAlert } = useGameState();

  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => {
        removeAlert(alerts[0].id);
      }, 5000); // Alerts disappear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [alerts, removeAlert]);

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none', // Allow clicks to pass through
    }}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            padding: '10px 20px',
            borderRadius: '5px',
            color: 'white',
            backgroundColor: alert.type === 'error' ? 'rgba(220, 38, 38, 0.9)' : alert.type === 'warning' ? 'rgba(251, 191, 36, 0.9)' : 'rgba(59, 130, 246, 0.9)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            textAlign: 'center',
            minWidth: '200px',
            maxWidth: '400px',
            pointerEvents: 'auto', // Re-enable pointer events for the alert itself
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
};

export default AlertsDisplay;


