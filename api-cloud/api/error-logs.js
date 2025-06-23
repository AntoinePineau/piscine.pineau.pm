/**
 * API endpoint pour la gestion des logs d'erreur du système de monitoring
 * Reçoit et stocke les erreurs provenant du Raspberry Pi
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'POST') {
            return await handleErrorLog(req, res);
        }
        
        if (req.method === 'GET') {
            return await getErrorLogs(req, res);
        }

        return res.status(405).json({
            success: false,
            error: 'Méthode non autorisée'
        });

    } catch (error) {
        console.error('Erreur dans error-logs API:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur interne'
        });
    }
}

/**
 * Enregistre un nouveau log d'erreur
 */
async function handleErrorLog(req, res) {
    if (!supabase) {
        console.error('Base de données non configurée');
        return res.status(500).json({
            success: false,
            error: 'Base de données non disponible'
        });
    }

    const { timestamp, error_type, error_message, context, source } = req.body;

    if (!timestamp || !error_type || !error_message) {
        return res.status(400).json({
            success: false,
            error: 'Données manquantes (timestamp, error_type, error_message requis)'
        });
    }

    try {
        const { data, error } = await supabase
            .from('error_logs')
            .insert([{
                timestamp: new Date(timestamp).toISOString(),
                error_type,
                error_message,
                context: context || {},
                source: source || 'unknown',
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Erreur Supabase lors de l\'insertion:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de l\'enregistrement'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Log d\'erreur enregistré'
        });

    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du log:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'enregistrement'
        });
    }
}

/**
 * Récupère les logs d'erreur récents
 */
async function getErrorLogs(req, res) {
    if (!supabase) {
        return res.status(200).json({
            success: true,
            data: [],
            message: 'Base de données non configurée'
        });
    }

    const { hours = 24, limit = 50, error_type } = req.query;

    try {
        const since = new Date();
        since.setHours(since.getHours() - parseInt(hours));

        let query = supabase
            .from('error_logs')
            .select('*')
            .gte('timestamp', since.toISOString())
            .order('timestamp', { ascending: false })
            .limit(parseInt(limit));

        if (error_type) {
            query = query.eq('error_type', error_type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erreur Supabase lors de la récupération:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }

        return res.status(200).json({
            success: true,
            data: data || [],
            count: data ? data.length : 0
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des logs:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération'
        });
    }
}