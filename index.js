const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

const getBaseUrl = (req) => {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || req.get('host');
  const protocol = req.protocol === 'https' || domain.includes('replit') ? 'https' : 'http';
  return `${protocol}://${domain}`;
};

const extractVideoId = (url) => {
  const match = url.match(/video\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
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
      download_url: `${baseUrl}/download?url_video=${encodeURIComponent(video.url)}`
    }));

    res.json({
      recherche: searchQuery,
      total: resultats.length,
      base_url: baseUrl,
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

  if (!videoUrl) {
    return res.status(400).json({
      error: 'Paramètre "url_video" requis',
      exemple: '/download?url_video=https://www.dailymotion.com/video/x506tg'
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

    const preferredQualities = ['1080', '720', '480', '380', '240', 'auto'];
    
    for (const quality of preferredQualities) {
      if (qualities[quality] && qualities[quality].length > 0) {
        const streams = qualities[quality];
        for (const stream of streams) {
          if (stream.type === 'video/mp4' && stream.url) {
            downloadUrl = stream.url;
            selectedQuality = quality;
            break;
          }
        }
        if (downloadUrl) break;
      }
    }

    if (!downloadUrl) {
      for (const quality of preferredQualities) {
        if (qualities[quality] && qualities[quality].length > 0) {
          downloadUrl = qualities[quality][0].url;
          selectedQuality = quality;
          break;
        }
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({
        error: 'Lien de téléchargement non trouvé',
        available_qualities: Object.keys(qualities)
      });
    }

    const filename = `${metadata.title || videoId}.mp4`.replace(/[^a-zA-Z0-9\-_.]/g, '_');

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

    res.json({
      video_id: videoId,
      titre: metadata.title,
      owner: metadata.owner?.screenname,
      duration: metadata.duration,
      thumbnail: metadata.poster_url,
      download_url: `${baseUrl}/download?url_video=${encodeURIComponent(videoUrl)}`,
      qualities: metadata.qualities ? Object.keys(metadata.qualities) : []
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
    routes: {
      recherche: {
        url: '/recherche?video=NomARechercher',
        exemple: `${baseUrl}/recherche?video=Ambondrona`
      },
      download: {
        url: '/download?url_video=URLDeLaVideo',
        exemple: `${baseUrl}/download?url_video=https://www.dailymotion.com/video/x506tg`
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
});
