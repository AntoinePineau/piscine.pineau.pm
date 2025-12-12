const { google } = require('googleapis');
const path = require('path');

/**
 * Service Google Drive pour stocker les données de la piscine en JSON
 *
 * Structure des fichiers sur Drive :
 * - measurements.json : Mesures récentes (derniers 7 jours)
 * - daily-averages.json : Moyennes journalières historiques
 * - error-logs.json : Logs d'erreurs
 * - alerts.json : Historique des alertes et conseils Gemini
 */

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.fileIds = {
      measurements: process.env.DRIVE_FILE_MEASUREMENTS_ID || null,
      dailyAverages: process.env.DRIVE_FILE_DAILY_AVERAGES_ID || null,
      errorLogs: process.env.DRIVE_FILE_ERROR_LOGS_ID || null,
      alerts: process.env.DRIVE_FILE_ALERTS_ID || null,
    };
  }

  /**
   * Initialise la connexion à Google Drive API
   */
  async initialize() {
    try {
      // Authentification via Service Account (credentials JSON)
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      const authClient = await auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: authClient });

      console.log('Google Drive API initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Drive API:', error);
      throw error;
    }
  }

  /**
   * Lit un fichier JSON depuis Google Drive
   * @param {string} fileType - Type de fichier (measurements, dailyAverages, errorLogs, alerts)
   * @returns {Promise<Object>} Données JSON parsées
   */
  async readJSON(fileType) {
    if (!this.drive) await this.initialize();

    const fileId = this.fileIds[fileType];
    if (!fileId) {
      console.warn(`No file ID for ${fileType}, creating new file...`);
      return this._createInitialFile(fileType);
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      // Si le fichier est vide, retourner structure par défaut
      if (!response.data || response.data === '') {
        return this._getDefaultStructure(fileType);
      }

      // Parse le JSON
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;

      return data;
    } catch (error) {
      console.error(`Error reading ${fileType} from Drive:`, error);

      // Si le fichier n'existe pas, le créer
      if (error.code === 404) {
        return this._createInitialFile(fileType);
      }

      throw error;
    }
  }

  /**
   * Écrit des données JSON dans Google Drive
   * @param {string} fileType - Type de fichier
   * @param {Object} data - Données à écrire
   * @returns {Promise<boolean>}
   */
  async writeJSON(fileType, data) {
    if (!this.drive) await this.initialize();

    const fileId = this.fileIds[fileType];
    const jsonContent = JSON.stringify(data, null, 2);

    try {
      if (fileId) {
        // Mise à jour du fichier existant
        await this.drive.files.update({
          fileId: fileId,
          media: {
            mimeType: 'application/json',
            body: jsonContent,
          },
        });
        console.log(`Updated ${fileType} on Google Drive`);
      } else {
        // Création d'un nouveau fichier
        const fileName = this._getFileName(fileType);
        const file = await this.drive.files.create({
          requestBody: {
            name: fileName,
            mimeType: 'application/json',
            parents: this.folderId ? [this.folderId] : [],
          },
          media: {
            mimeType: 'application/json',
            body: jsonContent,
          },
          fields: 'id',
        });

        this.fileIds[fileType] = file.data.id;
        console.log(`Created new ${fileType} file on Google Drive: ${file.data.id}`);
        console.warn(`⚠️  Add this to your .env: DRIVE_FILE_${fileType.toUpperCase()}_ID=${file.data.id}`);
      }

      return true;
    } catch (error) {
      console.error(`Error writing ${fileType} to Drive:`, error);
      throw error;
    }
  }

  /**
   * Ajoute une entrée à un fichier JSON (mesure, log, alerte)
   * @param {string} fileType
   * @param {Object} entry
   */
  async appendEntry(fileType, entry) {
    const data = await this.readJSON(fileType);

    // Ajouter le timestamp si non présent
    if (!entry.timestamp && !entry.created_at) {
      entry.timestamp = new Date().toISOString();
    }

    // Ajouter l'entrée au début du tableau
    if (!data.data) data.data = [];
    data.data.unshift(entry);

    // Limiter la taille (garder seulement les plus récents)
    const maxEntries = this._getMaxEntries(fileType);
    if (data.data.length > maxEntries) {
      data.data = data.data.slice(0, maxEntries);
    }

    // Mettre à jour les métadonnées
    data.lastUpdated = new Date().toISOString();
    data.count = data.data.length;

    await this.writeJSON(fileType, data);
    return entry;
  }

  /**
   * Récupère les dernières entrées
   * @param {string} fileType
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getLatestEntries(fileType, limit = 100) {
    const data = await this.readJSON(fileType);
    if (!data.data || data.data.length === 0) return [];

    return data.data.slice(0, limit);
  }

  /**
   * Récupère la dernière entrée
   * @param {string} fileType
   */
  async getLatestEntry(fileType) {
    const data = await this.readJSON(fileType);
    if (!data.data || data.data.length === 0) return null;

    return data.data[0];
  }

  /**
   * Filtre les entrées par période
   * @param {string} fileType
   * @param {Date} fromDate
   * @param {Date} toDate
   */
  async getEntriesByDateRange(fileType, fromDate, toDate) {
    const data = await this.readJSON(fileType);
    if (!data.data || data.data.length === 0) return [];

    return data.data.filter(entry => {
      const entryDate = new Date(entry.timestamp || entry.created_at || entry.date);
      return entryDate >= fromDate && entryDate <= toDate;
    });
  }

  // --- Méthodes privées ---

  _getFileName(fileType) {
    const names = {
      measurements: 'pool-measurements.json',
      dailyAverages: 'pool-daily-averages.json',
      errorLogs: 'pool-error-logs.json',
      alerts: 'pool-alerts.json',
    };
    return names[fileType] || `pool-${fileType}.json`;
  }

  _getDefaultStructure(fileType) {
    return {
      type: fileType,
      version: '1.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      count: 0,
      data: [],
    };
  }

  _getMaxEntries(fileType) {
    // Limites pour éviter des fichiers trop gros
    const limits = {
      measurements: 10080, // 7 jours * 24h * 60 mesures/heure = ~10k mesures
      dailyAverages: 730, // 2 ans de moyennes journalières
      errorLogs: 1000, // 1000 derniers logs
      alerts: 500, // 500 dernières alertes
    };
    return limits[fileType] || 1000;
  }

  async _createInitialFile(fileType) {
    const data = this._getDefaultStructure(fileType);
    await this.writeJSON(fileType, data);
    return data;
  }
}

// Singleton
let driveServiceInstance = null;

function getDriveService() {
  if (!driveServiceInstance) {
    driveServiceInstance = new GoogleDriveService();
  }
  return driveServiceInstance;
}

module.exports = {
  GoogleDriveService,
  getDriveService,
};
