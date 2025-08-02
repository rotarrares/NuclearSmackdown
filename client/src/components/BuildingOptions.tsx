import React from 'react';
import { Button } from './ui/button';
import { Building2, Anchor, Zap } from 'lucide-react';

interface BuildingOptionsProps {
  tileId: number;
  canBuildPort: boolean;
  onBuild: (structureType: 'city' | 'port' | 'missile_silo') => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export const BuildingOptions: React.FC<BuildingOptionsProps> = ({
  tileId,
  canBuildPort,
  onBuild,
  onClose,
  position
}) => {
  const safePosition = position || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  return (
    <div 
      style={{
        position: 'fixed',
        zIndex: 50,
        background: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid rgba(75, 85, 99, 0.8)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
        left: `${safePosition.x}px`,
        top: `${safePosition.y}px`,
        transform: 'translate(-50%, -50%)',
        color: 'white',
        minWidth: '200px'
      }}
    >
      <div style={{ 
        color: 'white', 
        fontSize: '14px', 
        fontWeight: '600', 
        marginBottom: '12px',
        textAlign: 'center'
      }}>
        Build Structure (100 gold)
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => onBuild('city')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
          }}
        >
          <Building2 size={16} />
          City
        </button>
        
        <button
          onClick={() => onBuild('port')}
          disabled={!canBuildPort}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: canBuildPort ? 'rgba(59, 130, 246, 0.1)' : 'rgba(75, 85, 99, 0.1)',
            border: `1px solid ${canBuildPort ? 'rgba(59, 130, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)'}`,
            borderRadius: '4px',
            color: canBuildPort ? 'white' : '#9CA3AF',
            cursor: canBuildPort ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (canBuildPort) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (canBuildPort) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            }
          }}
        >
          <Anchor size={16} />
          Port {!canBuildPort && "(Need water nearby)"}
        </button>
        
        <button
          onClick={() => onBuild('missile_silo')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
          }}
        >
          <Zap size={16} />
          Missile Silo
        </button>
      </div>
      
      <button
        onClick={onClose}
        style={{
          marginTop: '12px',
          width: '100%',
          padding: '8px',
          background: 'rgba(75, 85, 99, 0.1)',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          borderRadius: '4px',
          color: '#9CA3AF',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(75, 85, 99, 0.2)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(75, 85, 99, 0.1)';
          e.currentTarget.style.color = '#9CA3AF';
        }}
      >
        Cancel
      </button>
    </div>
  );
};