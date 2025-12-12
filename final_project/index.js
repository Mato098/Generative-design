import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { GameEngine } from './src/game/GameEngine.js';
import { ObserverInterface } from './src/observer/ObserverInterface.js';
import { exec } from 'child_process';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Initialize game engine
let gameEngine;
let observer;

// Initialize global game engine and observer at startup
global.gameEngine = new GameEngine();
global.observer = new ObserverInterface(global.gameEngine);

// WebSocket server for real-time communication
const server = app.listen(PORT, () => {
  console.log(`Game server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Set broadcast function on the initial game engine
global.gameEngine.setBroadcastFunction(broadcastToAll);

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current game state to new client
  if (global.gameEngine) {
    ws.send(JSON.stringify({
      type: 'gameState',
      data: global.gameEngine.getState()
    }));
  }
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'observerAction') {
        console.log(`⚡ Observer used ${data.action.type}:`, JSON.stringify(data.action.parameters));
        const result = await global.observer.executeAction(data.action);
        // Result is broadcast by executeObserverAction itself
      }
      
      if (data.type === 'animationComplete') {
        // Client finished playing animations
        console.log('🎬 Client animations complete, continuing game');
        global.gameEngine.continueAfterAnimation();
      }
      
    } catch (error) {
      console.error('WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// REST API endpoints
app.get('/api/game/state', (req, res) => {
  res.json(global.gameEngine.getState());
});

app.post('/api/game/start', async (req, res) => {
  try {
     // Hard reset: throw away old engine + observer
    global.gameEngine = new GameEngine();
    global.observer = new ObserverInterface(global.gameEngine);

    console.log('♻️♻️♻️♻️♻️♻️♻️ Game engine reset for new game');

    // Reattach broadcast function
    global.gameEngine.setBroadcastFunction(broadcastToAll);

    // Start fresh game
    await global.gameEngine.startGame(req.body.agents || []);
    
    broadcastToAll({
      type: 'gameStarted',
      data: global.gameEngine.getState()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/game/actions', (req, res) => {
  res.json(global.gameEngine.getActionHistory());
});
