// Pool de connexion PostgreSQL partagé pour optimiser le compute Neon
const { Pool } = require('pg');

// Pool unique partagé avec configuration optimisée
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Limiter les connexions pour économiser le compute
  max: 5, // Maximum 5 connexions simultanées (au lieu de 10 par défaut)
  min: 1, // Minimum 1 connexion active
  idleTimeoutMillis: 30000, // Fermer les connexions inactives après 30s
  connectionTimeoutMillis: 10000, // Timeout de connexion 10s
  maxUses: 7500, // Réutiliser chaque connexion max 7500 fois
  allowExitOnIdle: true // Permettre la fermeture propre
});

// Cache en mémoire simple avec TTL
const cache = new Map();
const CACHE_TTL = {
  latest: 30 * 1000,    // 30 secondes pour les dernières mesures
  stats: 5 * 60 * 1000, // 5 minutes pour les stats
  charts: 10 * 60 * 1000 // 10 minutes pour les graphiques
};

function getCacheKey(key, params = {}) {
  return `${key}_${JSON.stringify(params)}`;
}

function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
}

function setInCache(key, data, ttl) {
  cache.set(key, {
    data,
    expires: Date.now() + ttl
  });
  
  // Nettoyer le cache si trop d'entrées
  if (cache.size > 100) {
    const oldestKeys = Array.from(cache.keys()).slice(0, 50);
    oldestKeys.forEach(k => cache.delete(k));
  }
}

module.exports = {
  pool,
  cache: {
    get: getFromCache,
    set: setInCache,
    key: getCacheKey,
    TTL: CACHE_TTL
  }
};