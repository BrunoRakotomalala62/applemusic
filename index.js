const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const PORT = 5000;

const url = 'https://music.apple.com/fr/album/fihirana-ffpm-vol-1/1723344583';

async function scrapeWebsite() {
  try {
    console.log('Recuperation du contenu HTML...');
    const response = await axios.get(url);
    
    const htmlContent = response.data;
    
    console.log('Enregistrement du HTML dans web.html...');
    fs.writeFileSync('web.html', htmlContent);
    
    console.log('Le contenu HTML a ete enregistre avec succes dans web.html');
  } catch (error) {
    console.error('Une erreur est survenue:', error.message);
  }
}

scrapeWebsite();

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Apple Music</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
          max-width: 600px;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        p {
          font-size: 1.2rem;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        .music-icon {
          font-size: 4rem;
          margin-bottom: 2rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="music-icon">🎵</div>
        <h1>Apple Music</h1>
        <p>Welcome to your music application</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
