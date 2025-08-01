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
  return (
    <div 
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-4 shadow-lg"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="text-white text-sm font-semibold mb-3">
        Build Structure (100 gold)
      </div>
      
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBuild('city')}
          className="flex items-center gap-2 text-left justify-start"
        >
          <Building2 className="w-4 h-4" />
          City
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBuild('port')}
          disabled={!canBuildPort}
          className="flex items-center gap-2 text-left justify-start"
        >
          <Anchor className="w-4 h-4" />
          Port {!canBuildPort && "(Need water nearby)"}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBuild('missile_silo')}
          className="flex items-center gap-2 text-left justify-start"
        >
          <Zap className="w-4 h-4" />
          Missile Silo
        </Button>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="mt-2 w-full text-gray-400"
      >
        Cancel
      </Button>
    </div>
  );
};