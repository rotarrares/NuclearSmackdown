import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { storage } from "./storage";
import { GameServer } from "./gameServer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Initialize game server
  const gameServer = new GameServer();
  
  // Handle WebSocket connections
  wss.on('connection', (ws, request) => {
    console.log('New WebSocket connection from:', request.socket.remoteAddress);
    
    gameServer.handleConnection(ws);
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      gameServer.handleDisconnection(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // API Routes for game data
  app.get('/api/game/status', (req, res) => {
    res.json({
      players: gameServer.getPlayerCount(),
      uptime: process.uptime(),
      gameTime: gameServer.getGameTime()
    });
  });
  
  app.get('/api/game/leaderboard', (req, res) => {
    res.json(gameServer.getLeaderboard());
  });

  return httpServer;
}
