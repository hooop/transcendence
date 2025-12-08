// Configuration des URLs selon l'environnement
const isDev = import.meta.env.DEV;
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const host = window.location.host || 'localhost';

// Toujours utiliser les URLs dynamiques basées sur window.location
// Cela fonctionne à la fois en dev (avec NGINX) et en production
export const config = {
    // URL de l'API - Utilise toujours l'URL actuelle du navigateur
    API_URL: `${protocol}://${host}`,

    // URL WebSocket (WSS en HTTPS, WS en HTTP)
    WS_URL: `${wsProtocol}://${host}`,

    // URLs complètes pour les services
    GAME_WS_URL: `${wsProtocol}://${host}/api/game/ws`,
    CHAT_WS_URL: `${wsProtocol}://${host}/api/chat/ws`,
};

// En production, on utilise toujours HTTPS/WSS
if (!isDev) {
    console.log('Mode production: HTTPS/WSS activé');
    console.log('API URL:', config.API_URL);
    console.log('WebSocket URL:', config.WS_URL);
}
