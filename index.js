const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
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

function parseAlbums() {
  try {
    const html = fs.readFileSync('web.html', 'utf8');
    const $ = cheerio.load(html);
    const albums = [];
    
    $('.product-lockup').each((index, element) => {
      const title = $(element).find('[data-testid="product-lockup-title"]').text().trim();
      const artist = $(element).find('[data-testid="product-lockup-subtitle"]').text().trim();
      
      let imageUrl = '';
      const imgSource = $(element).find('source[type="image/webp"]').first();
      if (imgSource.length) {
        const srcset = imgSource.attr('srcset');
        if (srcset) {
          const firstUrl = srcset.split(',')[0].split(' ')[0];
          imageUrl = firstUrl;
        }
      }
      
      if (!imageUrl) {
        const img = $(element).find('img').first();
        if (img.length) {
          imageUrl = img.attr('src') || '';
        }
      }
      
      if (title) {
        albums.push({
          title: title,
          artist: artist,
          imageUrl: imageUrl
        });
      }
    });
    
    return albums;
  } catch (error) {
    console.error('Erreur lors du parsing:', error.message);
    return [];
  }
}

scrapeWebsite();

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
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
        <p>Bienvenue dans votre application musicale</p>
        <p><a href="/recherche?app=liste" style="color: white;">Voir les albums</a></p>
      </div>
    </body>
    </html>
  `);
});

app.get('/recherche', (req, res) => {
  const appParam = req.query.app;
  
  if (appParam === 'liste') {
    const albums = parseAlbums();
    
    let html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Liste des Albums - Apple Music</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #1a1a1a;
          min-height: 100vh;
          color: white;
          padding: 20px;
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
          color: #fa233b;
        }
        .albums-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .album-card {
          background: #2a2a2a;
          border-radius: 10px;
          overflow: hidden;
          transition: transform 0.3s;
        }
        .album-card:hover {
          transform: scale(1.05);
        }
        .album-image {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
        }
        .album-info {
          padding: 15px;
        }
        .album-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .album-artist {
          font-size: 0.85rem;
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .back-link {
          display: block;
          text-align: center;
          margin-bottom: 20px;
          color: #fa233b;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <a href="/" class="back-link">Retour</a>
      <h1>Albums Apple Music</h1>
      <div class="albums-grid">
    `;
    
    albums.forEach(album => {
      html += `
        <div class="album-card">
          <img src="${album.imageUrl}" alt="${album.title}" class="album-image" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
          <div class="album-info">
            <div class="album-title">${album.title}</div>
            <div class="album-artist">${album.artist}</div>
          </div>
        </div>
      `;
    });
    
    html += `
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } else {
    res.json({ error: 'Parametre app=liste requis' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/albums', (req, res) => {
  const albums = parseAlbums();
  res.json(albums);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
