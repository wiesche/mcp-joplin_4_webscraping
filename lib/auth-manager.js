import fs from 'fs';
import path from 'path';
import express from 'express';
import axios from 'axios';
import logger from './logger.js';

class AuthManager {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.joplinPort = options.joplinPort || 41184;
    this.configPath = options.configPath || path.join(process.cwd(), '.env');
    this.token = null;
    this.app = express();
    this.server = null;
    
    // Initialize
    this.loadToken();
    this.setupServer();
  }

  loadToken() {
    // Try to load from process.env first (priority)
    if (process.env.JOPLIN_TOKEN) {
      this.token = process.env.JOPLIN_TOKEN;
      return;
    }

    // Try to load from .env file
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf8');
      const match = content.match(/JOPLIN_TOKEN=(.*)/);
      if (match && match[1]) {
        this.token = match[1].trim();
      }
    }
  }

  getToken() {
    return this.token;
  }

  hasToken() {
    return !!this.token;
  }

  async validateToken(token) {
    try {
      const response = await axios.get(`http://127.0.0.1:${this.joplinPort}/ping`, {
        params: { token }
      });
      return response.data === 'JoplinClipperServer';
    } catch (error) {
      return false;
    }
  }

  saveToken(token) {
    this.token = token;
    
    // Update .env file
    let content = '';
    if (fs.existsSync(this.configPath)) {
      content = fs.readFileSync(this.configPath, 'utf8');
    }

    if (content.includes('JOPLIN_TOKEN=')) {
      content = content.replace(/JOPLIN_TOKEN=.*/, `JOPLIN_TOKEN=${token}`);
    } else {
      content += `\nJOPLIN_TOKEN=${token}`;
    }

    fs.writeFileSync(this.configPath, content);
    
    // Also update process.env for current session
    process.env.JOPLIN_TOKEN = token;
  }

  setupServer() {
    this.app.use(express.urlencoded({ extended: true }));
    
    this.app.get('/auth', (req, res) => {
      const status = this.hasToken() ? '<p style="color: green">Token is configured!</p>' : '<p style="color: red">Token is missing</p>';
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Joplin MCP Auth</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
            input { padding: 10px; width: 100%; box-sizing: border-box; margin: 10px 0; }
            button { padding: 10px 20px; background: #0066cc; color: white; border: none; cursor: pointer; }
            button:hover { background: #0052a3; }
            .error { color: red; }
            .success { color: green; }
          </style>
        </head>
        <body>
          <h1>Joplin MCP Server Authentication</h1>
          ${status}
          <p>Please enter your Joplin Web Clipper Authorization Token.</p>
          <p>You can find or generate this token in Joplin Desktop: <strong>Tools > Options > Web Clipper</strong></p>
          
          <form method="POST" action="/auth">
            <input type="text" name="token" placeholder="Enter your Joplin API Token" required />
            <button type="submit">Save Token</button>
          </form>
        </body>
        </html>
      `);
    });

    this.app.post('/auth', async (req, res) => {
      const { token } = req.body;
      
      if (!token) {
        return res.send('Token is required <a href="/auth">Try again</a>');
      }

      const isValid = await this.validateToken(token);
      
      if (isValid) {
        this.saveToken(token);
        res.send(`
          <h1 style="color: green">Success!</h1>
          <p>Token verified and saved successfully.</p>
          <p>You can now close this window and return to your AI Assistant.</p>
        `);
        // Close the auth server after successful token validation
        setTimeout(() => this.stop(), 1000);
      } else {
        res.send(`
          <h1 style="color: red">Invalid Token</h1>
          <p>The provided token could not be verified with Joplin.</p>
          <p>Please ensure Joplin is running and the Web Clipper service is enabled.</p>
          <a href="/auth">Try again</a>
        `);
      }
    });
  }

  start() {
    // Don't start if already running
    if (this.server && this.server.listening) {
      return;
    }

    // Try to find an available port if 3000 is taken, or just use a fixed range
    // For simplicity, we'll try 3000, then fall back to random
    this.server = this.app.listen(this.port, () => {
      logger.info(`Auth server listening at http://localhost:${this.port}/auth`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try a random port
        this.server = this.app.listen(0, () => {
          this.port = this.server.address().port;
          logger.info(`Auth server listening at http://localhost:${this.port}/auth`);
        });
      } else {
        logger.error('Failed to start auth server:', err);
      }
    });
  }

  stop() {
    if (this.server && this.server.listening) {
      this.server.close(() => {
        logger.info('Auth server stopped');
      });
      this.server = null;
    }
  }

  ensureStarted() {
    if (!this.server || !this.server.listening) {
      this.start();
    }
  }

  isRunning() {
    return this.server && this.server.listening;
  }

  getAuthUrl() {
    return `http://localhost:${this.port}/auth`;
  }
}

export default AuthManager;
