const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

app.get('/recherche', async (req, res) => {
  const searchQuery = req.query.video;

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Paramètre "video" requis',
      exemple: '/recherche?video=Ambondrona'
    });
  }

  try {
    const apiUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(searchQuery)}&fields=id,title,url,thumbnail_480_url,owner.screenname&limit=20`;
    
    const response = await axios.get(apiUrl);
    const videos = response.data.list;

    const resultats = videos.map(video => ({
      nom: video['owner.screenname'] || 'Inconnu',
      titre: video.title,
      image_url: video.thumbnail_480_url,
      video_url: video.url
    }));

    res.json({
      recherche: searchQuery,
      total: resultats.length,
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

app.get('/', (req, res) => {
  res.json({
    message: 'API de recherche Dailymotion',
    usage: '/recherche?video=NomARechercher',
    exemple: '/recherche?video=Ambondrona'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Exemple: http://localhost:${PORT}/recherche?video=Ambondrona`);
});
