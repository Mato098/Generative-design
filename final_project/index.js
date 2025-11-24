import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { GameEngine } from './src/game/GameEngine.js';
import { ObserverInterface } from './src/observer/ObserverInterface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Initialize game engine
const gameEngine = new GameEngine();
const observer = new ObserverInterface(gameEngine);

// WebSocket server for real-time communication
const server = app.listen(PORT, () => {
  console.log(`Game server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current game state to new client
  ws.send(JSON.stringify({
    type: 'gameState',
    data: gameEngine.getState()
  }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'observerAction') {
        const result = await observer.executeAction(data.action);
        broadcastToAll({
          type: 'actionExecuted',
          data: result
        });
      }
      
    } catch (error) {
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

function broadcastToAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// REST API endpoints
app.get('/api/game/state', (req, res) => {
  res.json(gameEngine.getState());
});

app.post('/api/game/start', async (req, res) => {
  try {
    await gameEngine.startGame(req.body.agents || []);
    broadcastToAll({
      type: 'gameStarted',
      data: gameEngine.getState()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/game/actions', (req, res) => {
  res.json(gameEngine.getActionHistory());
});

// Make broadcast function available to game engine
gameEngine.setBroadcastFunction(broadcastToAll);