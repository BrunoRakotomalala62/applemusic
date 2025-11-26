const express = require('express');
const axios = require('axios');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const QUALITES_DISPONIBLES = ['1080', '720', '480', '380', '360', '240', 'auto'];
const QUALITE_DEFAUT = '360';
const TEMP_DIR = '/tmp/videos';

let ffmpegAvailable = false;
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegAvailable = true;
  console.log('ffmpeg est disponible');
} catch (e) {
  console.warn('ATTENTION: ffmpeg non disponible - le téléchargement direct sera utilisé');
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const getBaseUrl = (req) => {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || 
                 process.env.REPLIT_DEV_DOMAIN || 
                 process.env.REPLIT_DOMAINS || 
                 req.get('host');
  const isSecure = req.protocol === 'https' || 
                   domain.includes('replit') || 
                   domain.includes('railway') ||
                   domain.includes('up.railway.app');
  const protocol = isSecure ? 'https' : 'http';
  return `${protocol}://${domain}`;
};

const extractVideoId = (url) => {
  const match = url.match(/video\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const normalizeQuality = (qualite) => {
  if (!qualite) return QUALITE_DEFAUT;
  const q = qualite.replace('p', '').toLowerCase();
  return QUALITES_DISPONIBLES.includes(q) ? q : QUALITE_DEFAUT;
};

const cleanupOldFiles = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 10 * 60 * 1000) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (e) {}
};

app.get('/recherche', async (req, res) => {
  const searchQuery = req.query.video;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Paramètre "video" requis',
      exemple: '/recherche?video=Ambondrona&page=1'
    });
  }

  try {
    const baseUrl = getBaseUrl(req);
    const apiUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(searchQuery)}&fields=id,title,url,thumbnail_480_url,owner.screenname&limit=${limit}&page=${page}`;
    
    const response = await axios.get(apiUrl);
    const videos = response.data.list;
    const hasMore = response.data.has_more || false;
    const total = response.data.total || videos.length;

    const resultats = videos.map(video => ({
      nom: video['owner.screenname'] || 'Inconnu',
      titre: video.title,
      image_url: video.thumbnail_480_url,
      video_url: video.url,
      download_url: `${baseUrl}/download?url_video=${encodeURIComponent(video.url)}&qualite=${QUALITE_DEFAUT}p`
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      recherche: searchQuery,
      pagination: {
        page_actuelle: page,
        resultats_par_page: limit,
        total_resultats: total,
        total_pages: totalPages,
        a_plus_de_resultats: hasMore,
        page_suivante: hasMore ? `${baseUrl}/recherche?video=${encodeURIComponent(searchQuery)}&page=${page + 1}&limit=${limit}` : null,
        page_precedente: page > 1 ? `${baseUrl}/recherche?video=${encodeURIComponent(searchQuery)}&page=${page - 1}&limit=${limit}` : null
      },
      base_url: baseUrl,
      qualites_disponibles: QUALITES_DISPONIBLES.map(q => q === 'auto' ? 'auto' : `${q}p`),
      videos: resultats
    });

  } catch (error) {
    console.error('Erreur lors de la recherche:', error.message);
    res.status(500).json({
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
});

app.get('/download', async (req, res) => {
  const videoUrl = req.query.url_video;
  const qualiteParam = req.query.qualite;
  const qualite = normalizeQuality(qualiteParam);

  if (!videoUrl) {
    return res.status(400).json({
      error: 'Paramètre "url_video" requis',
      exemple: '/download?url_video=https://www.dailymotion.com/video/x506tg&qualite=360p',
      qualites_disponibles: QUALITES_DISPONIBLES.map(q => q === 'auto' ? 'auto' : `${q}p`)
    });
  }

  try {
    cleanupOldFiles();
    
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
      return res.status(400).json({
        error: 'URL vidéo invalide',
        message: 'Impossible d\'extraire l\'ID de la vidéo'
      });
    }

    console.log(`Téléchargement vidéo: ${videoId}, qualité: ${qualite}`);

    const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
    const metadataResponse = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.dailymotion.com/',
        'Origin': 'https://www.dailymotion.com'
      }
    });

    const metadata = metadataResponse.data;
    const qualities = metadata.qualities;

    if (!qualities) {
      return res.status(404).json({
        error: 'Vidéo non disponible',
        message: 'Impossible de récupérer les liens de téléchargement'
      });
    }

    let streamUrl = null;
    let selectedQuality = null;

    const findStreamForQuality = (q) => {
      if (qualities[q] && qualities[q].length > 0) {
        const streams = qualities[q];
        for (const stream of streams) {
          if (stream.url) {
            return { url: stream.url, quality: q, type: stream.type };
          }
        }
      }
      return null;
    };

    let result = findStreamForQuality(qualite);

    if (!result) {
      const fallbackOrder = ['380', '480', '360', '240', '720', '1080', 'auto'];
      for (const q of fallbackOrder) {
        result = findStreamForQuality(q);
        if (result) break;
      }
    }

    if (!result) {
      return res.status(404).json({
        error: 'Lien de téléchargement non trouvé',
        qualite_demandee: `${qualite}p`,
        qualites_disponibles: Object.keys(qualities)
      });
    }

    streamUrl = result.url;
    selectedQuality = result.quality;

    const qualityLabel = selectedQuality === 'auto' ? '' : `_${selectedQuality}p`;
    const safeTitle = (metadata.title || videoId).replace(/[^a-zA-Z0-9\-_. ]/g, '_').substring(0, 50);
    const filename = `${safeTitle}${qualityLabel}.mp4`;

    console.log(`Stream URL: ${streamUrl.substring(0, 80)}...`);

    if (!ffmpegAvailable) {
      console.log('ffmpeg non disponible - redirection vers le stream direct');
      return res.redirect(streamUrl);
    }

    console.log(`Conversion avec ffmpeg...`);

    const ffmpegArgs = [
      '-i', streamUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      '-headers', 'Referer: https://www.dailymotion.com/\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n',
      '-y',
      'pipe:1'
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('time=') || msg.includes('frame=')) {
        process.stdout.write('.');
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('Erreur ffmpeg:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors de la conversion' });
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`\nffmpeg terminé avec code: ${code}`);
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
      }
    });

    req.on('close', () => {
      ffmpeg.kill('SIGTERM');
    });

  } catch (error) {
    console.error('Erreur lors du téléchargement:', error.message);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erreur lors du téléchargement',
        message: error.message
      });
    }
  }
});

app.get('/info', async (req, res) => {
  const videoUrl = req.query.url_video;

  if (!videoUrl) {
    return res.status(400).json({
      error: 'Paramètre "url_video" requis',
      exemple: '/info?url_video=https://www.dailymotion.com/video/x506tg'
    });
  }

  try {
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
      return res.status(400).json({
        error: 'URL vidéo invalide'
      });
    }

    const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
    const metadataResponse = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.dailymotion.com/'
      }
    });

    const metadata = metadataResponse.data;
    const baseUrl = getBaseUrl(req);
    const availableQualities = metadata.qualities ? Object.keys(metadata.qualities) : [];

    res.json({
      video_id: videoId,
      titre: metadata.title,
      owner: metadata.owner?.screenname,
      duration: metadata.duration,
      thumbnail: metadata.poster_url,
      qualites_disponibles: availableQualities,
      download_urls: availableQualities.map(q => ({
        qualite: q === 'auto' ? 'auto' : `${q}p`,
        url: `${baseUrl}/download?url_video=${encodeURIComponent(videoUrl)}&qualite=${q === 'auto' ? 'auto' : q + 'p'}`
      }))
    });

  } catch (error) {
    console.error('Erreur:', error.message);
    res.status(500).json({
      error: 'Erreur lors de la récupération des informations',
      message: error.message
    });
  }
});

app.get('/', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.json({
    message: 'API de recherche et téléchargement Dailymotion',
    base_url: baseUrl,
    qualites_disponibles: QUALITES_DISPONIBLES.map(q => q === 'auto' ? 'auto' : `${q}p`),
    qualite_defaut: `${QUALITE_DEFAUT}p`,
    routes: {
      recherche: {
        url: '/recherche?video=NomARechercher',
        exemple: `${baseUrl}/recherche?video=Ambondrona`
      },
      download: {
        url: '/download?url_video=URLDeLaVideo&qualite=360p',
        exemple: `${baseUrl}/download?url_video=https://www.dailymotion.com/video/x506tg&qualite=720p`
      },
      info: {
        url: '/info?url_video=URLDeLaVideo',
        exemple: `${baseUrl}/info?url_video=https://www.dailymotion.com/video/x506tg`
      }
    }
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN || `localhost:${PORT}`;
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Base URL: https://${domain}`);
  console.log(`Qualité par défaut: ${QUALITE_DEFAUT}p`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt gracieux...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});
