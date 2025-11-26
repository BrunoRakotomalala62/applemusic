const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

const QUALITES_DISPONIBLES = ['1080', '720', '480', '380', '360', '240', 'auto'];
const QUALITE_DEFAUT = '360';

const getBaseUrl = (req) => {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || req.get('host');
  const protocol = req.protocol === 'https' || domain.includes('replit') ? 'https' : 'http';
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

app.get('/recherche', async (req, res) => {
  const searchQuery = req.query.video;

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Paramètre "video" requis',
      exemple: '/recherche?video=Ambondrona'
    });
  }

  try {
    const baseUrl = getBaseUrl(req);
    const apiUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(searchQuery)}&fields=id,title,url,thumbnail_480_url,owner.screenname&limit=20`;
    
    const response = await axios.get(apiUrl);
    const videos = response.data.list;

    const resultats = videos.map(video => ({
      nom: video['owner.screenname'] || 'Inconnu',
      titre: video.title,
      image_url: video.thumbnail_480_url,
      video_url: video.url,
      download_url: `${baseUrl}/download?url_video=${encodeURIComponent(video.url)}&qualite=${QUALITE_DEFAUT}p`
    }));

    res.json({
      recherche: searchQuery,
      total: resultats.length,
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
    const videoId = extractVideoId(videoUrl);
    
    if (!videoId) {
      return res.status(400).json({
        error: 'URL vidéo invalide',
        message: 'Impossible d\'extraire l\'ID de la vidéo'
      });
    }

    const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
    const metadataResponse = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

    let downloadUrl = null;
    let selectedQuality = null;

    const findStreamForQuality = (q) => {
      if (qualities[q] && qualities[q].length > 0) {
        const streams = qualities[q];
        for (const stream of streams) {
          if (stream.type === 'video/mp4' && stream.url) {
            return { url: stream.url, quality: q };
          }
        }
        return { url: streams[0].url, quality: q };
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

    downloadUrl = result.url;
    selectedQuality = result.quality;

    const qualityLabel = selectedQuality === 'auto' ? '' : `_${selectedQuality}p`;
    const filename = `${metadata.title || videoId}${qualityLabel}.mp4`.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.redirect(downloadUrl);

  } catch (error) {
    console.error('Erreur lors du téléchargement:', error.message);
    res.status(500).json({
      error: 'Erreur lors du téléchargement',
      message: error.message
    });
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Base URL: https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:' + PORT}`);
  console.log(`Qualité par défaut: ${QUALITE_DEFAUT}p`);
});
