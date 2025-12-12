const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Service Gemini AI pour analyser les mesures de piscine
 * et fournir des conseils d'entretien personnalisés
 */

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Initialise Gemini AI
   */
  initialize() {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);

    // Utilise Gemini 2.0 Flash pour des réponses rapides et économiques
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    console.log('Gemini AI initialized successfully');
  }

  /**
   * Analyse une mesure et détermine s'il y a des problèmes
   * @param {Object} measurement - Mesure actuelle
   * @param {Array} recentHistory - Historique récent (optionnel)
   * @returns {Promise<Object>} Analyse et conseils
   */
  async analyzeMeasurement(measurement, recentHistory = []) {
    if (!this.model) this.initialize();

    // Préparer le contexte pour Gemini
    const context = this._buildAnalysisContext(measurement, recentHistory);

    try {
      const prompt = `Tu es un expert en entretien de piscine. Analyse ces données et donne des conseils concrets et actionnables.

${context}

Analyse ces données et réponds au format JSON suivant :
{
  "severity": "ok|warning|critical",
  "issues": [
    {
      "metric": "ph|redox|temperature|salt|system",
      "problem": "description du problème",
      "impact": "impact sur la baignade et l'équipement"
    }
  ],
  "recommendations": [
    {
      "action": "action à effectuer",
      "priority": "high|medium|low",
      "details": "détails de l'action",
      "quantity": "quantité si applicable (ex: 500ml de pH-)"
    }
  ],
  "summary": "résumé en 2-3 phrases pour l'utilisateur débutant",
  "canSwim": true|false,
  "reasoning": "explication du diagnostic"
}

Sois précis, pédagogue et rassurant. L'utilisateur est débutant en entretien de piscine.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parser la réponse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Ajouter métadonnées
      analysis.analyzedAt = new Date().toISOString();
      analysis.model = 'gemini-2.0-flash-exp';

      return analysis;

    } catch (error) {
      console.error('Error analyzing with Gemini:', error);

      // Fallback en cas d'erreur
      return {
        severity: 'warning',
        issues: [],
        recommendations: [{
          action: 'Vérifier manuellement les paramètres',
          priority: 'medium',
          details: 'Le système d\'analyse automatique est temporairement indisponible',
          quantity: null
        }],
        summary: 'Erreur d\'analyse. Vérifiez les paramètres manuellement.',
        canSwim: null,
        error: error.message,
        analyzedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Analyse une série d'alertes système pour diagnostic avancé
   * @param {Object} currentMeasurement
   * @param {Array} alarmHistory
   */
  async diagnoseSystemAlarms(currentMeasurement, alarmHistory = []) {
    if (!this.model) this.initialize();

    const alarmContext = this._buildAlarmContext(currentMeasurement, alarmHistory);

    try {
      const prompt = `Tu es un technicien expert en régulateurs de piscine automatisés. Analyse ces alarmes système.

${alarmContext}

Diagnostic au format JSON :
{
  "systemStatus": "ok|degraded|critical",
  "diagnoses": [
    {
      "component": "pump_plus|pump_minus|pump_chlore|filter|sensor",
      "issue": "description du problème détecté",
      "cause": "cause probable",
      "urgency": "immediate|soon|monitor"
    }
  ],
  "actions": [
    {
      "step": "action à effectuer",
      "order": 1,
      "technical": true|false,
      "description": "explication détaillée"
    }
  ],
  "summary": "diagnostic en langage simple",
  "needsProfessional": true|false
}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const diagnosis = JSON.parse(jsonMatch[0]);
      diagnosis.analyzedAt = new Date().toISOString();

      return diagnosis;

    } catch (error) {
      console.error('Error diagnosing system alarms:', error);
      return {
        systemStatus: 'unknown',
        diagnoses: [],
        actions: [],
        summary: 'Erreur de diagnostic système',
        needsProfessional: true,
        error: error.message,
        analyzedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Construit le contexte d'analyse pour Gemini
   */
  _buildAnalysisContext(measurement, history) {
    const { ph, redox, temperature, salt, alarm, warning, alarm_redox } = measurement;

    let context = `📊 MESURES ACTUELLES :
- pH : ${ph !== null ? ph : 'N/A'} (optimal : 7.0-7.6)
- Redox/ORP : ${redox !== null ? redox + ' mV' : 'N/A'} (optimal : 650-750 mV)
- Température : ${temperature !== null ? temperature + ' °C' : 'N/A'}
- Salinité : ${salt !== null ? salt + ' g/L' : 'N/A'}
- État pompe pH+ : ${measurement.pump_plus_active ? 'ACTIVE' : 'inactive'}
- État pompe pH- : ${measurement.pump_minus_active ? 'ACTIVE' : 'inactive'}
- État pompe chlore : ${measurement.pump_chlore_active ? 'ACTIVE' : 'inactive'}
- État filtre : ${measurement.filter_relay_active ? 'ACTIF' : 'inactif'}
- Alarme générale : ${alarm ? 'OUI ⚠️' : 'non'}
- Avertissement : ${warning ? 'OUI ⚠️' : 'non'}
- Alarme Redox : ${alarm_redox ? 'OUI ⚠️' : 'non'}
`;

    if (history && history.length > 0) {
      context += `\n📈 ÉVOLUTION RÉCENTE (${history.length} dernières mesures) :\n`;

      const avgPh = history.reduce((sum, m) => sum + (m.ph || 0), 0) / history.length;
      const avgRedox = history.reduce((sum, m) => sum + (m.redox || 0), 0) / history.length;
      const avgTemp = history.reduce((sum, m) => sum + (m.temperature || 0), 0) / history.length;

      context += `- pH moyen : ${avgPh.toFixed(2)}\n`;
      context += `- Redox moyen : ${avgRedox.toFixed(0)} mV\n`;
      context += `- Température moyenne : ${avgTemp.toFixed(1)} °C\n`;

      // Tendances
      const phTrend = this._calculateTrend(history.map(m => m.ph));
      const redoxTrend = this._calculateTrend(history.map(m => m.redox));

      context += `- Tendance pH : ${phTrend}\n`;
      context += `- Tendance Redox : ${redoxTrend}\n`;
    }

    return context;
  }

  /**
   * Construit le contexte pour diagnostic d'alarmes
   */
  _buildAlarmContext(measurement, alarmHistory) {
    let context = `🚨 ÉTAT SYSTÈME ACTUEL :
- Type régulateur : ${measurement.regulator_type || 'N/A'}
- Alarme générale : ${measurement.alarm ? 'ACTIVE' : 'inactive'}
- Avertissement : ${measurement.warning ? 'ACTIVE' : 'inactive'}
- Alarme Redox : ${measurement.alarm_redox ? 'ACTIVE' : 'inactive'}
- Pompes actives : ${[
  measurement.pump_plus_active && 'pH+',
  measurement.pump_minus_active && 'pH-',
  measurement.pump_chlore_active && 'Chlore'
].filter(Boolean).join(', ') || 'aucune'}
- Filtre : ${measurement.filter_relay_active ? 'en marche' : 'arrêté'}

📊 PARAMÈTRES EAU :
- pH : ${measurement.ph}
- Redox : ${measurement.redox} mV
- Température : ${measurement.temperature} °C
- Salinité : ${measurement.salt} g/L
`;

    if (alarmHistory && alarmHistory.length > 0) {
      context += `\n📜 HISTORIQUE DES ALARMES (${alarmHistory.length} occurrences récentes) :\n`;
      alarmHistory.slice(0, 5).forEach((alarm, i) => {
        context += `${i + 1}. ${new Date(alarm.timestamp).toLocaleString('fr-FR')} - Alarme: ${alarm.alarm}, Warning: ${alarm.warning}\n`;
      });
    }

    return context;
  }

  /**
   * Calcule la tendance d'une série de valeurs
   */
  _calculateTrend(values) {
    if (!values || values.length < 2) return 'stable';

    const validValues = values.filter(v => v !== null && v !== undefined);
    if (validValues.length < 2) return 'stable';

    const first = validValues[validValues.length - 1];
    const last = validValues[0];
    const diff = last - first;
    const percentChange = (diff / first) * 100;

    if (Math.abs(percentChange) < 2) return 'stable';
    if (diff > 0) return `en hausse (+${percentChange.toFixed(1)}%)`;
    return `en baisse (${percentChange.toFixed(1)}%)`;
  }
}

// Singleton
let geminiServiceInstance = null;

function getGeminiService() {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}

module.exports = {
  GeminiService,
  getGeminiService,
};
