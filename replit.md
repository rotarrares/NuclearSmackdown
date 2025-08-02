# OpenFront.io - MMO Real-Time Strategy Globe Game

## Overview

OpenFront.io is a web-based MMO real-time strategy game built around a 3D interactive globe. Players spawn on a spherical world map composed of triangular tiles arranged in a geodesic pattern, expanding their territory, managing population and resources, and competing for global dominance. The game features real-time multiplayer interaction with WebSocket communication and a Three.js-powered 3D globe interface.

## Recent Changes (January 2025)

- **Globe Rendering**: Fixed black tile rendering issue by switching to individual tile meshes with proper materials
- **Tile Interaction**: Implemented precise tile hover and click detection using separate mesh components
- **Territory Expansion**: Fixed server-side adjacency checks to allow proper territory expansion
- **Visual Feedback**: Added hover indicators and proper color coding for tile ownership
- **Performance**: Optimized to ~80 manageable triangular tiles for smooth interaction
- **Ballistic Missile System**: Complete implementation with left-click launching from Missile Silos
- **Trajectory Visualization**: Enhanced high-arc ballistic trajectories with animated warheads and launch effects
- **Nuclear Blast Effects**: 2-tile radius damage affecting multiple tiles with 80% population loss and structure destruction
- **Real-time Rendering**: Missiles persist in game state with proper trajectory calculation and spherical interpolation
- **Advanced Missile Animation**: Animated red warheads travel along white trajectory tubes with yellow marker points and launch flash effects

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built with React and TypeScript, utilizing Three.js for 3D globe rendering and WebGL graphics. The application uses a component-based architecture with:

- **3D Globe Rendering**: Three.js with React Three Fiber for the interactive spherical world map
- **Geodesic Geometry**: Custom GlobeGeometry class implementing icosahedral subdivision for seamless tile coverage (4,002 tiles total)
- **State Management**: Zustand stores for game state, multiplayer connection, and audio management
- **UI Framework**: Radix UI components with Tailwind CSS for styling
- **Real-time Communication**: WebSocket client for multiplayer synchronization

The globe uses a sophisticated geodesic polyhedron approach, subdividing an icosahedron into approximately 4,000 tiles (12 pentagons, 3,990 hexagons) to create a mathematically perfect spherical tiling system.

### Backend Architecture
The server implements a Node.js/Express architecture with WebSocket support for real-time gameplay:

- **Game Server**: Central GameServer class managing all game logic and state
- **WebSocket Management**: Real-time communication for player actions, territory updates, and game synchronization
- **Game State Management**: Server-side GameState class tracking players, tiles, and world state
- **RESTful API**: Express routes for game status, leaderboards, and auxiliary data

The game loop runs at 60 FPS on the server, handling population growth, resource generation, and territory management calculations.

### Population and Economy System
Players manage a unified population pool distributed between soldiers and workers via ratio sliders. Workers generate gold passively, which funds territorial expansion and military actions. Cities increase population caps and growth rates, while ports enable maritime advantages.

### Territory and Combat System
The spawn system places new players in low-density regions (typically polar areas). Territory expansion costs gold and follows adjacency rules. The tile-based system supports city construction, port building, and population distribution across controlled territories.

### Data Storage Solutions
Currently implements in-memory storage via MemStorage class for user data and game state. The system is designed with a storage interface (IStorage) to easily swap to PostgreSQL using Drizzle ORM when needed. Database schema is defined in shared/schema.ts for user authentication and game data persistence.

### Real-time Synchronization
WebSocket connections maintain persistent communication between clients and server. The system handles player spawning, territory expansion, population management, and real-time game state updates. Connection management includes ping/pong for connection health and graceful disconnection handling.

## External Dependencies

### Database and ORM
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database integration
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### 3D Graphics and Game Engine
- **Three.js**: Core 3D graphics library for WebGL rendering
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers and abstractions for React Three Fiber
- **@react-three/postprocessing**: Post-processing effects for enhanced visuals
- **vite-plugin-glsl**: GLSL shader support for custom graphics effects

### UI and Styling
- **Radix UI**: Comprehensive set of low-level UI primitives (@radix-ui/react-*)
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for UI elements
- **class-variance-authority**: Utility for creating type-safe variant APIs

### Real-time Communication
- **WebSocket (ws)**: Server-side WebSocket implementation for real-time multiplayer
- **Native WebSocket API**: Client-side WebSocket for server communication

### Development and Build Tools
- **Vite**: Build tool and development server with HMR support
- **TypeScript**: Type safety across the entire codebase
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind integration

### Audio and Media
- **HTML5 Audio API**: Browser-native audio for game sounds and music
- Support for various audio formats (.mp3, .ogg, .wav) and 3D model formats (.gltf, .glb)

The architecture prioritizes real-time performance, scalable multiplayer support, and mathematical precision in the globe geometry system while maintaining clean separation between client rendering, server logic, and data persistence layers.