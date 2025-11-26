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
      <title>Apple Music API - Guide d'utilisation</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab, #667eea, #764ba2);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
          min-height: 100vh;
          color: white;
          overflow-x: hidden;
        }
        
        .floating-notes {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }
        
        .note {
          position: absolute;
          font-size: 2rem;
          opacity: 0.3;
          animation: float 6s ease-in-out infinite;
        }
        
        .note:nth-child(1) { left: 10%; top: 20%; animation-delay: 0s; }
        .note:nth-child(2) { left: 20%; top: 60%; animation-delay: 1s; font-size: 1.5rem; }
        .note:nth-child(3) { left: 70%; top: 30%; animation-delay: 2s; }
        .note:nth-child(4) { left: 80%; top: 70%; animation-delay: 3s; font-size: 2.5rem; }
        .note:nth-child(5) { left: 50%; top: 80%; animation-delay: 4s; }
        .note:nth-child(6) { left: 5%; top: 85%; animation-delay: 1.5s; font-size: 1.8rem; }
        .note:nth-child(7) { left: 90%; top: 15%; animation-delay: 2.5s; }
        .note:nth-child(8) { left: 35%; top: 10%; animation-delay: 3.5s; font-size: 1.2rem; }
        
        .container {
          position: relative;
          z-index: 1;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .header {
          text-align: center;
          padding: 3rem 0;
          animation: slideUp 1s ease-out;
        }
        
        .logo {
          font-size: 5rem;
          margin-bottom: 1rem;
          animation: pulse 2s ease-in-out infinite;
          display: inline-block;
        }
        
        h1 {
          font-size: 3.5rem;
          margin-bottom: 0.5rem;
          text-shadow: 3px 3px 6px rgba(0,0,0,0.3);
          background: linear-gradient(90deg, #fff, #ffd700, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        
        .subtitle {
          font-size: 1.3rem;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        
        .cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        
        .card {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          border: 1px solid rgba(255,255,255,0.2);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: slideUp 1s ease-out backwards;
        }
        
        .card:nth-child(1) { animation-delay: 0.2s; }
        .card:nth-child(2) { animation-delay: 0.4s; }
        .card:nth-child(3) { animation-delay: 0.6s; }
        
        .card:hover {
          transform: translateY(-10px) scale(1.02);
          background: rgba(255,255,255,0.25);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .card-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: block;
          animation: bounce 2s ease infinite;
        }
        
        .card h2 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #ffd700;
        }
        
        .card p {
          font-size: 1rem;
          line-height: 1.6;
          opacity: 0.9;
          margin-bottom: 1rem;
        }
        
        .endpoint {
          background: rgba(0,0,0,0.3);
          padding: 0.8rem 1rem;
          border-radius: 10px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.85rem;
          margin: 0.5rem 0;
          word-break: break-all;
          border-left: 4px solid #ffd700;
        }
        
        .btn {
          display: inline-block;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #ffd700, #ff6b6b);
          color: #1a1a2e;
          text-decoration: none;
          border-radius: 50px;
          font-weight: bold;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-shadow: 0 5px 20px rgba(255,215,0,0.4);
          margin: 0.5rem;
        }
        
        .btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(255,215,0,0.6);
        }
        
        .btn-secondary {
          background: linear-gradient(135deg, #23a6d5, #23d5ab);
        }
        
        .btn-secondary:hover {
          box-shadow: 0 10px 30px rgba(35,166,213,0.6);
        }
        
        .links-section {
          text-align: center;
          margin-top: 3rem;
          padding: 2rem;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          animation: slideUp 1s ease-out 0.8s backwards;
        }
        
        .links-section h2 {
          margin-bottom: 1.5rem;
          font-size: 1.8rem;
        }
        
        .footer {
          text-align: center;
          padding: 2rem;
          opacity: 0.7;
          font-size: 0.9rem;
          margin-top: 2rem;
        }
        
        .tag {
          display: inline-block;
          background: rgba(255,215,0,0.3);
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          margin: 0.2rem;
        }
        
        @media (max-width: 600px) {
          h1 { font-size: 2.5rem; }
          .logo { font-size: 4rem; }
          .container { padding: 1rem; }
          .card { padding: 1.5rem; }
        }
      </style>
    </head>
    <body>
      <div class="floating-notes">
        <span class="note">🎵</span>
        <span class="note">🎶</span>
        <span class="note">🎼</span>
        <span class="note">🎵</span>
        <span class="note">🎶</span>
        <span class="note">🎵</span>
        <span class="note">🎶</span>
        <span class="note">🎼</span>
      </div>
      
      <div class="container">
        <div class="header">
          <span class="logo">🎵</span>
          <h1>Apple Music API</h1>
          <p class="subtitle">Scraper et API pour extraire les donnees d'Apple Music</p>
          <div>
            <span class="tag">REST API</span>
            <span class="tag">JSON</span>
            <span class="tag">Scraping</span>
          </div>
        </div>
        
        <div class="cards-container">
          <div class="card">
            <span class="card-icon">📋</span>
            <h2>Liste des Albums</h2>
            <p>Recuperez la liste des albums recommandes avec leurs titres et images de couverture.</p>
            <div class="endpoint">GET /recherche?app=liste</div>
            <p><strong>Retourne:</strong> Array d'objets avec titre et imageUrl</p>
          </div>
          
          <div class="card">
            <span class="card-icon">💿</span>
            <h2>Details d'un Album</h2>
            <p>Obtenez les informations completes d'un album: artiste, image, et liste des pistes avec duree.</p>
            <div class="endpoint">GET /album?url={apple_music_url}</div>
            <p><strong>Retourne:</strong> Page HTML avec details de l'album</p>
          </div>
          
          <div class="card">
            <span class="card-icon">🔌</span>
            <h2>API JSON Album</h2>
            <p>Endpoint API pour obtenir les donnees d'un album en format JSON pur.</p>
            <div class="endpoint">GET /api/album?url={apple_music_url}</div>
            <p><strong>Retourne:</strong> JSON avec albumTitle, artistName, tracks[]</p>
          </div>
          
          <div class="card">
            <span class="card-icon">⬇️</span>
            <h2>Telecharger MP3</h2>
            <p>Telechargez directement les fichiers audio vers votre telephone ou ordinateur.</p>
            <div class="endpoint">GET /download?url_audio={audio_url}</div>
            <p><strong>Action:</strong> Lance le telechargement du fichier MP3/M4A</p>
          </div>
        </div>
        
        <div class="links-section">
          <h2>🚀 Essayer Maintenant</h2>
          <p style="margin-bottom: 1.5rem;">Cliquez sur les liens ci-dessous pour voir l'API en action</p>
          <a href="/recherche?app=liste" class="btn">📋 Voir les Albums (JSON)</a>
          <a href="/api/album?url=https://music.apple.com/fr/album/fihirana-ffpm-vol-1/1723344583" class="btn btn-secondary">💿 Exemple Album API</a>
          <a href="/album?url=https://music.apple.com/fr/album/fihirana-ffpm-vol-1/1723344583" class="btn" style="background: linear-gradient(135deg, #e73c7e, #764ba2);">🎨 Voir Album (HTML)</a>
        </div>
        
        <div class="footer">
          <p>Apple Music Scraper API - Fait avec ❤️</p>
          <p style="margin-top: 0.5rem;">Utilisez les endpoints ci-dessus pour integrer les donnees dans vos applications</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/recherche', (req, res) => {
  const appParam = req.query.app;
  
  if (appParam === 'liste') {
    const albums = parseAlbums();
    const result = albums.map(album => ({
      titre: album.title,
      imageUrl: album.imageUrl
    }));
    res.json(result);
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
      .track-download {
        padding-left: 40px;
        margin-top: 10px;
      }
      .download-btn {
        display: inline-block;
        padding: 8px 16px;
        background: linear-gradient(135deg, #00c853, #00e676);
        color: #fff;
        text-decoration: none;
        border-radius: 25px;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,200,83,0.4);
      }
      .download-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,200,83,0.6);
        background: linear-gradient(135deg, #00e676, #69f0ae);
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
  
  const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || 'localhost:5000'}`;
  
  albumData.tracks.forEach(track => {
    const downloadUrl = `${baseUrl}/download?url_audio=${encodeURIComponent(track.audioUrl)}`;
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
        <div class="track-download">
          <a href="${downloadUrl}" class="download-btn">⬇️ Telecharger MP3</a>
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

function getBaseUrl(req) {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || req.get('host');
  const protocol = req.protocol || 'https';
  return `${protocol}://${domain}`;
}

app.get('/download', async (req, res) => {
  const audioUrl = req.query.url_audio;
  
  if (!audioUrl) {
    return res.status(400).json({ 
      error: 'Parametre url_audio requis',
      exemple: '/download?url_audio=https://music.apple.com/...',
      base_url: getBaseUrl(req)
    });
  }
  
  try {
    console.log('Telechargement audio:', audioUrl);
    
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'audio/*,*/*',
        'Referer': 'https://music.apple.com/'
      },
      timeout: 30000
    });
    
    const urlParts = audioUrl.split('/');
    let filename = urlParts[urlParts.length - 1].split('?')[0] || 'audio.mp3';
    if (!filename.endsWith('.mp3') && !filename.endsWith('.m4a') && !filename.endsWith('.aac')) {
      filename = 'audio.mp3';
    }
    
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    const contentLength = response.headers['content-length'];
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'no-cache');
    
    response.data.pipe(res);
    
    response.data.on('error', (err) => {
      console.error('Erreur streaming:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors du streaming audio' });
      }
    });
    
  } catch (error) {
    console.error('Erreur telechargement:', error.message);
    res.status(500).json({ 
      error: 'Impossible de telecharger le fichier audio',
      details: error.message,
      url_attempted: audioUrl
    });
  }
});

app.get('/api/base-url', (req, res) => {
  res.json({
    base_url: getBaseUrl(req),
    download_endpoint: `${getBaseUrl(req)}/download?url_audio=`,
    exemple: `${getBaseUrl(req)}/download?url_audio=https://audio-ssl.itunes.apple.com/...`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
