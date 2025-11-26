const axios = require('axios');
const fs = require('fs');

// URL du site à scraper
const url = 'https://www.dailymotion.com/search/Ambondrona/top-results';

// Fonction asynchrone pour récupérer et sauvegarder le HTML
async function scrapeWebsite() {
try {
// Envoyer une requête GET à l'URL
console.log('Récupération du contenu HTML...');
const response = await axios.get(url);

// Récupérer le contenu HTML
const htmlContent = response.data;

// Enregistrer le contenu dans un fichier
console.log('Enregistrement du HTML dans web.html...');
fs.writeFileSync('web.html', htmlContent);

console.log('Le contenu HTML a été enregistré avec succès dans web.html');
} catch (error) {
console.error('Une erreur est survenue:', error.message);
}
}

// Exécuter la fonction
scrapeWebsite();