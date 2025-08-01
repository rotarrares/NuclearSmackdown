import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import "@fontsource/inter";

import Globe from "./components/Globe";
import GameUI from "./components/GameUI";
import { useMultiplayer } from "./lib/stores/useMultiplayer";

function App() {
  const { connect, isConnected } = useMultiplayer();

  useEffect(() => {
    // Connect to multiplayer server on app start
    connect();
  }, [connect]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Canvas for the globe */}
      <Canvas
        camera={{
          position: [0, 0, 5],
          fov: 45,
          near: 0.1,
          far: 1000
        }}
        gl={{
          antialias: true,
          powerPreference: "default"
        }}
      >
        <color attach="background" args={["#000011"]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        {/* Globe Controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          autoRotate={false}
          autoRotateSpeed={0.5}
        />

        <Suspense fallback={null}>
          <Globe />
        </Suspense>
      </Canvas>

      {/* Game UI Overlay */}
      <GameUI />
      
      {/* Connection Status */}
      {!isConnected && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Connecting to server...
        </div>
      )}
    </div>
  );
}

export default App;
