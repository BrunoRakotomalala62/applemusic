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
        albums.push({ title, artist, imageUrl });
      }
    });
    
    return albums;
  } catch (error) {
    console.error('Erreur lors du parsing:', error.message);
    return [];
  }
}

async function scrapeAlbumTracks(albumUrl) {
  try {
    const response = await axios.get(albumUrl);
    const html = response.data;
    const $ = cheerio.load(html);
    
    let albumTitle = '';
    let artistName = '';
    let imageUrl = '';
    const tracks = [];
    
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        if (jsonData['@type'] === 'MusicAlbum') {
          albumTitle = jsonData.name || '';
          if (jsonData.byArtist) {
            artistName = jsonData.byArtist.name || '';
          }
          if (jsonData.image) {
            imageUrl = jsonData.image;
          }
          if (jsonData.track && jsonData.track.itemListElement) {
            jsonData.track.itemListElement.forEach((item, index) => {
              if (item.item && item.item['@type'] === 'MusicRecording') {
                tracks.push({
                  position: item.position || index + 1,
                  name: item.item.name,
                  duration: item.item.duration || '',
                  audioUrl: item.item.url || ''
                });
              }
            });
          }
        }
      } catch (e) {}
    });
    
    if (tracks.length === 0) {
      const trackRegex = /"@type":"MusicRecording","name":"([^"]+)","duration":"([^"]+)","url":"([^"]+)"/g;
      let match;
      let position = 1;
      const seenTracks = new Set();
      
      while ((match = trackRegex.exec(html)) !== null) {
        const trackName = match[1];
        if (!seenTracks.has(trackName)) {
          seenTracks.add(trackName);
          tracks.push({
            position: position++,
            name: trackName,
            duration: match[2],
            audioUrl: match[3]
          });
        }
      }
    }
    
    if (!imageUrl) {
      const srcsetMatch = html.match(/srcset="(https:\/\/is1-ssl\.mzstatic\.com\/image\/thumb\/[^"]+)"/);
      if (srcsetMatch) {
        imageUrl = srcsetMatch[1].split(',')[0].split(' ')[0];
      }
    }
    
    if (!albumTitle) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        albumTitle = titleMatch[1].split(' - ')[0].trim();
      }
    }
    
    return { albumTitle, artistName, imageUrl, tracks };
  } catch (error) {
    console.error('Erreur scraping album:', error.message);
    return { albumTitle: '', artistName: '', imageUrl: '', tracks: [] };
  }
}

function formatDuration(isoDuration) {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .container { text-align: center; padding: 2rem; max-width: 600px; }
        h1 { font-size: 3rem; margin-bottom: 1rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
        p { font-size: 1.2rem; opacity: 0.9; margin-bottom: 1rem; }
        a { color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="font-size: 4rem; margin-bottom: 2rem;">🎵</div>
        <h1>Apple Music</h1>
        <p>Bienvenue dans votre application musicale</p>
        <p><a href="/recherche?app=liste">Voir les albums</a></p>
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #1a1a1a;
          min-height: 100vh;
          color: white;
          padding: 20px;
        }
        h1 { text-align: center; margin-bottom: 30px; color: #fa233b; }
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
        .album-card:hover { transform: scale(1.05); }
        .album-image { width: 100%; aspect-ratio: 1; object-fit: cover; }
        .album-info { padding: 15px; }
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
    
    html += `</div></body></html>`;
    res.send(html);
  } else {
    res.json({ error: 'Parametre app=liste requis' });
  }
});

app.get('/album', async (req, res) => {
  const albumUrl = req.query.url;
  
  if (!albumUrl) {
    return res.json({ error: 'Parametre url requis. Ex: /album?url=https://music.apple.com/fr/album/...' });
  }
  
  const albumData = await scrapeAlbumTracks(albumUrl);
  
  let html = `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${albumData.albumTitle} - Apple Music</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #1a1a1a;
        min-height: 100vh;
        color: white;
        padding: 20px;
      }
      .back-link {
        display: block;
        text-align: center;
        margin-bottom: 20px;
        color: #fa233b;
        text-decoration: none;
      }
      .album-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 30px;
        text-align: center;
      }
      .album-cover {
        width: 250px;
        height: 250px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        margin-bottom: 20px;
      }
      .album-title { font-size: 1.8rem; color: #fff; margin-bottom: 10px; }
      .album-artist { font-size: 1.2rem; color: #fa233b; margin-bottom: 10px; }
      .image-url {
        font-size: 0.75rem;
        color: #666;
        word-break: break-all;
        max-width: 500px;
        background: #2a2a2a;
        padding: 10px;
        border-radius: 5px;
        margin-top: 10px;
      }
      .tracks-container {
        max-width: 800px;
        margin: 0 auto;
      }
      .tracks-title {
        font-size: 1.3rem;
        margin-bottom: 20px;
        color: #fa233b;
        text-align: center;
      }
      .track-item {
        padding: 15px;
        background: #2a2a2a;
        border-radius: 8px;
        margin-bottom: 10px;
        transition: background 0.3s;
      }
      .track-item:hover { background: #3a3a3a; }
      .track-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      .track-number {
        width: 40px;
        font-size: 1.1rem;
        color: #888;
        font-weight: 600;
      }
      .track-name {
        flex: 1;
        font-size: 1rem;
      }
      .track-duration {
        color: #888;
        font-size: 0.9rem;
      }
      .track-audio-url {
        font-size: 0.75rem;
        color: #666;
        word-break: break-all;
        padding-left: 40px;
        margin-top: 5px;
      }
      .track-audio-url a {
        color: #fa233b;
        text-decoration: none;
      }
      .track-audio-url a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <a href="/recherche?app=liste" class="back-link">Retour aux albums</a>
    
    <div class="album-header">
      <img src="${albumData.imageUrl}" alt="${albumData.albumTitle}" class="album-cover" onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
      <h1 class="album-title">${albumData.albumTitle}</h1>
      <p class="album-artist">${albumData.artistName}</p>
      <div class="image-url"><strong>Image URL:</strong> ${albumData.imageUrl}</div>
    </div>
    
    <div class="tracks-container">
      <h2 class="tracks-title">Liste des titres (${albumData.tracks.length} pistes)</h2>
  `;
  
  albumData.tracks.forEach(track => {
    html += `
      <div class="track-item">
        <div class="track-header">
          <span class="track-number">${track.position}</span>
          <span class="track-name">${track.name}</span>
          <span class="track-duration">${formatDuration(track.duration)}</span>
        </div>
        <div class="track-audio-url">
          <strong>url_audio:</strong> <a href="${track.audioUrl}" target="_blank">${track.audioUrl}</a>
        </div>
      </div>
    `;
  });
  
  html += `</div></body></html>`;
  res.send(html);
});

app.get('/api/album', async (req, res) => {
  const albumUrl = req.query.url;
  if (!albumUrl) {
    return res.json({ error: 'Parametre url requis' });
  }
  const albumData = await scrapeAlbumTracks(albumUrl);
  albumData.tracks = albumData.tracks.map(t => ({
    ...t,
    durationFormatted: formatDuration(t.duration)
  }));
  res.json(albumData);
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
