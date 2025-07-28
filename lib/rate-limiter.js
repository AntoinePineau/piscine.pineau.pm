// Rate limiter simple pour limiter les requêtes et économiser le compute
const rateLimits = new Map();

function getRateLimitKey(req) {
  // Utiliser l'IP ou un header spécifique comme clé
  return req.headers['x-forwarded-for'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, []);
  }
  
  const requests = rateLimits.get(key);
  
  // Nettoyer les requêtes anciennes
  const recentRequests = requests.filter(time => time > windowStart);
  rateLimits.set(key, recentRequests);
  
  // Vérifier la limite
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  // Ajouter cette requête
  recentRequests.push(now);
  
  return true;
}

// Middleware de rate limiting
function rateLimiter(options = {}) {
  const {
    maxRequests = 30,     // Max 30 requêtes
    windowMs = 60 * 1000, // Par minute
    message = 'Trop de requêtes, veuillez patienter'
  } = options;
  
  return (req, res, next) => {
    const key = getRateLimitKey(req);
    
    const allowed = checkRateLimit(key, maxRequests, windowMs);
    
    if (!allowed) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    if (next) next();
    return true;
  };
}

// Nettoyer périodiquement le cache
setInterval(() => {
  const now = Date.now();
  const cleanupThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, requests] of rateLimits.entries()) {
    const recentRequests = requests.filter(time => time > now - cleanupThreshold);
    if (recentRequests.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, recentRequests);
    }
  }
}, 60000); // Nettoyer chaque minute

module.exports = {
  rateLimiter,
  checkRateLimit: (req, maxRequests = 30, windowMs = 60000) => {
    const key = getRateLimitKey(req);
    return checkRateLimit(key, maxRequests, windowMs);
  }
};