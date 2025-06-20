// Configuration API Cloud - pointer vers l'API qui fonctionne déjà
const API_BASE_URL = 'https://pool-monitor-api.vercel.app/api'; // API séparée qui fonctionne
const UPDATE_INTERVAL = 120000; // 2 minutes (plus fréquent que les 5 min du RPi pour éviter d'attendre)
const CHART_COLORS = {
    ph: '#0288D1',        // Bleu piscine principal
    temperature: '#FF8F00', // Orange soleil
    redox: '#00ACC1',     // Turquoise
    salt: '#26C6DA'       // Cyan
};

// Variables globales
let updateTimer;
let charts = {};
let apiStatus = 'loading'; // 'loading', 'ok', 'error'
let lastSuccessfulUpdate = null;

// Configuration auto de l'API selon l'environnement
function getApiUrl() {
    // En développement local
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return '/api';
    }
    // En production, utiliser la variable d'environnement ou l'URL par défaut
    return window.API_URL || API_BASE_URL;
}

const ACTUAL_API_URL = getApiUrl();

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('Initialisation de Pool Monitor...');
    console.log('API URL:', ACTUAL_API_URL);
    
    // Gestion du statut réseau
    setupNetworkListeners();
    
    // Configuration des événements
    setupEventListeners();
    
    // Initialisation des informations d'affichage
    updateDataFrequencyInfo(document.getElementById('chart-interval').value);
    
    // Chargement initial des données
    await loadInitialData();
    
    // Démarrage des mises à jour automatiques
    startAutoUpdate();
    
    console.log('Pool Monitor initialisé');
}

function setupNetworkListeners() {
    // Surveillance de la connexion internet basique
    window.addEventListener('online', () => {
        console.log('Connexion internet rétablie');
        loadInitialData();
    });
    
    window.addEventListener('offline', () => {
        console.log('Connexion internet perdue');
        updateApiStatus('error', 'Pas de connexion internet');
    });
}

function setupEventListeners() {
    // Contrôles des graphiques
    document.getElementById('time-range').addEventListener('change', handleTimeRangeChange);
    document.getElementById('chart-interval').addEventListener('change', handleIntervalChange);
    document.getElementById('refresh-charts').addEventListener('click', () => {
        refreshAllData();
    });
    
    // Contrôles personnalisés
    document.querySelector('.btn-apply-custom').addEventListener('click', applyCustomRange);
    document.getElementById('custom-hours').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyCustomRange();
        }
    });
    
    // Navigation mobile
    setupMobileNavigation();
    
    // Gérer l'affichage mobile vs desktop
    handleResponsiveDisplay();
    window.addEventListener('resize', handleResponsiveDisplay);
}

async function loadInitialData() {
    updateApiStatus('loading', 'Chargement des données...');
    
    try {
        // Chargement en parallèle
        await Promise.all([
            loadLatestData(),
            loadStats(),
            loadChartData()
        ]);
        updateApiStatus('ok', 'API fonctionnelle');
    } catch (error) {
        console.error('Erreur lors du chargement initial:', error);
        updateApiStatus('error', 'Problème API');
    }
}

async function refreshAllData() {
    const refreshBtn = document.getElementById('refresh-charts');
    const icon = refreshBtn.querySelector('i');
    
    // Animation du bouton
    icon.classList.add('fa-spin');
    refreshBtn.disabled = true;
    
    try {
        await loadInitialData();
    } finally {
        icon.classList.remove('fa-spin');
        refreshBtn.disabled = false;
    }
}

// Fonction API générique avec gestion d'erreurs
async function apiCall(endpoint, options = {}) {
    const url = `${ACTUAL_API_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            timeout: 10000,
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Erreur API ${endpoint}:`, error);
        throw error;
    }
}

// Chargement des dernières données
async function loadLatestData() {
    try {
        const result = await apiCall('/measurements/latest');
        
        if (result.success && result.data) {
            updateCurrentValues(result.data);
            updateLastUpdateTime(result.data.timestamp);
            removeLoadingStates();
            lastSuccessfulUpdate = new Date();
            updateApiStatus('ok', 'API fonctionnelle');
        } else {
            throw new Error('Réponse API invalide');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des dernières données:', error);
        updateApiStatus('error', 'Impossible de récupérer les données');
        throw error;
    }
}

function removeLoadingStates() {
    document.querySelectorAll('.loading').forEach(el => {
        el.classList.remove('loading');
    });
}

// Mise à jour des valeurs actuelles
function updateCurrentValues(data) {
    // pH
    const phValue = parseFloat(data.ph).toFixed(2);
    document.getElementById('current-ph').textContent = phValue;
    document.getElementById('ph-status').textContent = getPhStatus(data.ph);
    document.getElementById('ph-status').className = `card-status ${getPhStatusClass(data.ph)}`;
    
    // Température
    const tempValue = parseFloat(data.temperature).toFixed(1);
    document.getElementById('current-temperature').textContent = tempValue;
    document.getElementById('temperature-status').textContent = getTemperatureStatus(data.temperature);
    document.getElementById('temperature-status').className = `card-status ${getTemperatureStatusClass(data.temperature)}`;
    
    // Redox
    const redoxValue = Math.round(data.redox);
    document.getElementById('current-redox').textContent = redoxValue;
    document.getElementById('redox-status').textContent = getRedoxStatus(data.redox);
    document.getElementById('redox-status').className = `card-status ${getRedoxStatusClass(data.redox)}`;
    
    // Sel
    const saltValue = parseFloat(data.salt).toFixed(1);
    document.getElementById('current-salt').textContent = saltValue;
    document.getElementById('salt-status').textContent = getSaltStatus(data.salt);
    document.getElementById('salt-status').className = `card-status ${getSaltStatusClass(data.salt)}`;
    
    // État des pompes
    updatePumpStatus('pump-plus', data.pump_plus_active);
    updatePumpStatus('pump-minus', data.pump_minus_active);
    updatePumpStatus('pump-chlore', data.pump_chlore_active);
    updatePumpStatus('filter-relay', data.filter_relay_active);
    
    // Alertes
    updateAlerts(data);
}

// Fonctions de statut pour pH
function getPhStatus(ph) {
    if (ph >= 7.0 && ph <= 7.4) return 'Optimal';
    if (ph >= 6.8 && ph <= 7.6) return 'Acceptable';
    return 'Attention';
}

function getPhStatusClass(ph) {
    if (ph >= 7.0 && ph <= 7.4) return 'status-optimal';
    if (ph >= 6.8 && ph <= 7.6) return 'status-warning';
    return 'status-danger';
}

// Fonctions de statut pour température
function getTemperatureStatus(temp) {
    if (temp >= 18 && temp <= 28) return 'Normal';
    if (temp >= 15 && temp <= 32) return 'Acceptable';
    return 'Attention';
}

function getTemperatureStatusClass(temp) {
    if (temp >= 18 && temp <= 28) return 'status-optimal';
    if (temp >= 15 && temp <= 32) return 'status-warning';
    return 'status-danger';
}

// Fonctions de statut pour redox
function getRedoxStatus(redox) {
    if (redox >= 650 && redox <= 750) return 'Optimal';
    if (redox >= 600 && redox <= 800) return 'Acceptable';
    return 'Attention';
}

function getRedoxStatusClass(redox) {
    if (redox >= 650 && redox <= 750) return 'status-optimal';
    if (redox >= 600 && redox <= 800) return 'status-warning';
    return 'status-danger';
}

// Fonctions de statut pour sel
function getSaltStatus(salt) {
    if (salt >= 3.0 && salt <= 5.0) return 'Optimal';
    if (salt >= 2.5 && salt <= 6.0) return 'Acceptable';
    return 'Attention';
}

function getSaltStatusClass(salt) {
    if (salt >= 3.0 && salt <= 5.0) return 'status-optimal';
    if (salt >= 2.5 && salt <= 6.0) return 'status-warning';
    return 'status-danger';
}

// Mise à jour de l'état des pompes
function updatePumpStatus(elementId, isActive) {
    const element = document.getElementById(elementId);
    element.className = `pump-indicator ${isActive ? 'on' : 'off'}`;
}

// Mise à jour des alertes
function updateAlerts(data) {
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';
    
    const alerts = [];
    
    // Vérification des alarmes
    if (data.alarm > 0) {
        alerts.push({
            type: 'error',
            icon: 'fas fa-exclamation-triangle',
            message: `Alarme système: Code ${data.alarm}`
        });
    }
    
    if (data.warning > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fas fa-exclamation-circle',
            message: `Avertissement: Code ${data.warning}`
        });
    }
    
    if (data.alarm_redox > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fas fa-bolt',
            message: `Alarme redox: Code ${data.alarm_redox}`
        });
    }
    
    // Vérification des valeurs critiques
    if (data.ph < 6.8 || data.ph > 7.6) {
        alerts.push({
            type: 'warning',
            icon: 'fas fa-tint',
            message: `pH hors limites: ${data.ph.toFixed(2)}`
        });
    }
    
    if (data.temperature < 15 || data.temperature > 32) {
        alerts.push({
            type: 'warning',
            icon: 'fas fa-thermometer-half',
            message: `Température anormale: ${data.temperature.toFixed(1)}°C`
        });
    }
    
    if (alerts.length === 0) {
        alerts.push({
            type: 'info',
            icon: 'fas fa-check-circle',
            message: 'Tous les paramètres sont normaux'
        });
    }
    
    // Affichage des alertes
    alerts.forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${alert.type}`;
        alertElement.innerHTML = `
            <i class="${alert.icon}"></i>
            ${alert.message}
        `;
        alertsList.appendChild(alertElement);
    });
}

// Mise à jour du statut de l'API
function updateApiStatus(status, message) {
    const statusElement = document.getElementById('api-status');
    apiStatus = status;
    
    switch (status) {
        case 'ok':
            statusElement.className = 'status api-ok';
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Données à jour';
            break;
        case 'error':
            statusElement.className = 'status api-error';
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + (message || 'Problème API');
            break;
        case 'loading':
        default:
            statusElement.className = 'status api-loading';
            statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (message || 'Chargement...');
            break;
    }
}

// Mise à jour de l'heure de dernière mise à jour
function updateLastUpdateTime(timestamp) {
    const lastUpdateElement = document.getElementById('last-update');
    const date = new Date(timestamp);
    lastUpdateElement.textContent = `Dernière mesure: ${formatDate(timestamp)}`;
}

// Chargement des statistiques
async function loadStats() {
    try {
        const result = await apiCall('/measurements/stats?hours=24');
        
        if (result.success && result.data) {
            updateStatsDisplay(result.data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

// Mise à jour de l'affichage des statistiques
function updateStatsDisplay(stats) {
    // pH
    document.getElementById('ph-min').textContent = stats.min_ph ? parseFloat(stats.min_ph).toFixed(2) : '--';
    document.getElementById('ph-avg').textContent = stats.avg_ph ? parseFloat(stats.avg_ph).toFixed(2) : '--';
    document.getElementById('ph-max').textContent = stats.max_ph ? parseFloat(stats.max_ph).toFixed(2) : '--';
    
    // Température
    document.getElementById('temp-min').textContent = stats.min_temperature ? parseFloat(stats.min_temperature).toFixed(1) : '--';
    document.getElementById('temp-avg').textContent = stats.avg_temperature ? parseFloat(stats.avg_temperature).toFixed(1) : '--';
    document.getElementById('temp-max').textContent = stats.max_temperature ? parseFloat(stats.max_temperature).toFixed(1) : '--';
    
    // Redox
    document.getElementById('redox-min').textContent = stats.min_redox ? Math.round(parseFloat(stats.min_redox)) : '--';
    document.getElementById('redox-avg').textContent = stats.avg_redox ? Math.round(parseFloat(stats.avg_redox)) : '--';
    document.getElementById('redox-max').textContent = stats.max_redox ? Math.round(parseFloat(stats.max_redox)) : '--';
    
    // Sel
    document.getElementById('salt-min').textContent = stats.min_salt ? parseFloat(stats.min_salt).toFixed(1) : '--';
    document.getElementById('salt-avg').textContent = stats.avg_salt ? parseFloat(stats.avg_salt).toFixed(1) : '--';
    document.getElementById('salt-max').textContent = stats.max_salt ? parseFloat(stats.max_salt).toFixed(1) : '--';
}

// Gestion du changement de période
function handleTimeRangeChange() {
    const timeRange = document.getElementById('time-range').value;
    const customGroup = document.getElementById('custom-range-group');
    
    if (timeRange === 'custom') {
        customGroup.style.display = 'block';
    } else {
        customGroup.style.display = 'none';
        loadChartData();
    }
}

// Gestion du changement d'intervalle
function handleIntervalChange() {
    const interval = document.getElementById('chart-interval').value;
    updateDataFrequencyInfo(interval);
    loadChartData();
}

// Application de la période personnalisée
function applyCustomRange() {
    const customHours = document.getElementById('custom-hours').value;
    if (customHours && customHours > 0) {
        loadChartData();
    }
}

// Mise à jour des informations sur la fréquence
function updateDataFrequencyInfo(interval) {
    const dataFrequencyElement = document.getElementById('data-frequency');
    const frequencyMap = {
        '5min': 'Fréquence: 5 minutes',
        '15min': 'Fréquence: 15 minutes', 
        '30min': 'Fréquence: 30 minutes',
        'hour': 'Fréquence: 1 heure',
        'day': 'Fréquence: 1 jour'
    };
    
    dataFrequencyElement.textContent = frequencyMap[interval] || 'Fréquence: 5 minutes';
}

// Chargement des données pour les graphiques
async function loadChartData() {
    try {
        const timeRangeValue = document.getElementById('time-range').value;
        const interval = document.getElementById('chart-interval').value;
        
        let hours;
        if (timeRangeValue === 'custom') {
            hours = document.getElementById('custom-hours').value;
        } else {
            hours = timeRangeValue;
        }
        
        // Conversion des nouveaux intervalles pour l'API
        const intervalMap = {
            '5min': 'minute',
            '15min': 'minute', 
            '30min': 'minute',
            'hour': 'hour',
            'day': 'day'
        };
        
        const apiInterval = intervalMap[interval] || 'hour';
        
        const result = await apiCall(`/measurements/chart-data?hours=${hours}&interval=${apiInterval}`);
        
        if (result.success && result.data) {
            updateCharts(result.data, interval);
            updateDataPointsInfo(result.data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données graphiques:', error);
    }
}

// Mise à jour du nombre de points de données
function updateDataPointsInfo(chartData) {
    const dataPointsElement = document.getElementById('data-points');
    if (chartData && chartData.categories) {
        dataPointsElement.textContent = `Points de données: ${chartData.categories.length}`;
    } else {
        dataPointsElement.textContent = 'Points de données: --';
    }
}

// Mise à jour des graphiques
function updateCharts(chartData, interval = 'hour') {
    // Configuration commune pour tous les graphiques
    const commonConfig = {
        chart: {
            type: 'line',
            backgroundColor: 'transparent',
            height: 300
        },
        title: {
            text: null
        },
        credits: {
            enabled: false
        },
        legend: {
            enabled: false
        },
        xAxis: {
            categories: chartData.categories,
            labels: {
                rotation: getRotationForInterval(interval),
                style: {
                    fontSize: '11px'
                },
                step: getStepForInterval(interval, chartData.categories.length)
            }
        },
        plotOptions: {
            line: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: true,
                            radius: 5
                        }
                    }
                },
                lineWidth: 2
            }
        },
        tooltip: {
            shared: true,
            crosshairs: true,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#ccc',
            borderWidth: 1,
            shadow: true
        }
    };

    // Graphique pH
    const phSeries = chartData.series.find(s => s.name === 'pH');
    if (phSeries && phSeries.data.some(val => val !== null)) {
        charts.ph = Highcharts.chart('ph-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'pH' },
                min: 6.5,
                max: 8.0,
                plotBands: [{
                    from: 7.0,
                    to: 7.4,
                    color: 'rgba(2, 136, 209, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#0288D1', fontSize: '10px' }
                    }
                }]
            },
            series: [{
                name: 'pH',
                data: phSeries.data,
                color: CHART_COLORS.ph
            }]
        });
    }

    // Graphique Température
    const tempSeries = chartData.series.find(s => s.name === 'Température (°C)');
    if (tempSeries && tempSeries.data.some(val => val !== null)) {
        charts.temperature = Highcharts.chart('temperature-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Température (°C)' },
                plotBands: [{
                    from: 18,
                    to: 28,
                    color: 'rgba(255, 143, 0, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#FF8F00', fontSize: '10px' }
                    }
                }]
            },
            series: [{
                name: 'Température',
                data: tempSeries.data,
                color: CHART_COLORS.temperature
            }]
        });
    }

    // Graphique Redox
    const redoxSeries = chartData.series.find(s => s.name === 'Redox (mV)');
    if (redoxSeries && redoxSeries.data.some(val => val !== null)) {
        charts.redox = Highcharts.chart('redox-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Redox (mV)' },
                plotBands: [{
                    from: 650,
                    to: 750,
                    color: 'rgba(0, 172, 193, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#00ACC1', fontSize: '10px' }
                    }
                }]
            },
            series: [{
                name: 'Redox',
                data: redoxSeries.data,
                color: CHART_COLORS.redox
            }]
        });
    }

    // Graphique Sel
    const saltSeries = chartData.series.find(s => s.name === 'Sel (g/L)');
    if (saltSeries && saltSeries.data.some(val => val !== null)) {
        charts.salt = Highcharts.chart('salt-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Sel (g/L)' },
                plotBands: [{
                    from: 3.0,
                    to: 5.0,
                    color: 'rgba(38, 198, 218, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#26C6DA', fontSize: '10px' }
                    }
                }]
            },
            series: [{
                name: 'Sel',
                data: saltSeries.data,
                color: CHART_COLORS.salt
            }]
        });
    }
}

// Démarrage des mises à jour automatiques
function startAutoUpdate() {
    updateTimer = setInterval(async () => {
        try {
            await loadLatestData();
            await loadStats();
        } catch (error) {
            // L'erreur est déjà gérée dans loadLatestData
            console.log('Mise à jour automatique échouée, nouvelle tentative dans', UPDATE_INTERVAL/1000, 'secondes');
        }
    }, UPDATE_INTERVAL);
}

// Arrêt des mises à jour automatiques
function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
}

// Gestion de la visibilité de l'onglet
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoUpdate();
    } else {
        startAutoUpdate();
        loadLatestData().catch(error => {
            console.log('Rechargement lors du retour sur l\'onglet échoué');
        });
        loadStats().catch(error => {
            console.log('Rechargement des stats lors du retour sur l\'onglet échoué');
        });
    }
});

// Fonctions utilitaires pour l'affichage des graphiques
function getRotationForInterval(interval) {
    const rotationMap = {
        '5min': -90,
        '15min': -45,
        '30min': -45,
        'hour': -45,
        'day': 0
    };
    return rotationMap[interval] || -45;
}

function getStepForInterval(interval, dataLength) {
    if (interval === '5min' && dataLength > 100) {
        return Math.ceil(dataLength / 50); // Afficher 1 label sur 50 max
    }
    if (interval === '15min' && dataLength > 50) {
        return Math.ceil(dataLength / 25); // Afficher 1 label sur 25 max
    }
    if (interval === '30min' && dataLength > 30) {
        return Math.ceil(dataLength / 15); // Afficher 1 label sur 15 max
    }
    return 1; // Afficher tous les labels pour les autres cas
}

// Fonction utilitaire pour formater les dates avec fuseau horaire CEST
function formatDate(dateString) {
    const date = new Date(dateString);
    // Convertir l'heure UTC vers CEST (GMT+2)
    return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris' // CEST/CET selon la saison
    });
}

// Navigation mobile
function setupMobileNavigation() {
    const mobileNav = document.querySelector('.mobile-time-nav');
    const quickBtns = mobileNav.querySelectorAll('.time-quick-btn');
    
    quickBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Retirer la classe active de tous les boutons
            quickBtns.forEach(b => b.classList.remove('active'));
            // Ajouter la classe active au bouton cliqué
            btn.classList.add('active');
            
            // Appliquer les paramètres
            const hours = btn.dataset.hours;
            const interval = btn.dataset.interval;
            
            // Mettre à jour les contrôles principaux
            document.getElementById('time-range').value = hours;
            document.getElementById('chart-interval').value = interval;
            
            // Recharger les données
            updateDataFrequencyInfo(interval);
            loadChartData();
        });
    });
}

// Gestion responsive
function handleResponsiveDisplay() {
    const mobileNav = document.querySelector('.mobile-time-nav');
    const regularControls = document.querySelector('.chart-controls');
    
    if (window.innerWidth <= 768) {
        mobileNav.style.display = 'flex';
        regularControls.style.display = 'none';
    } else {
        mobileNav.style.display = 'none';
        regularControls.style.display = 'block';
    }
}

// Fonction pour convertir UTC vers heure locale (CEST)
function convertToLocalTime(utcDateString) {
    const utcDate = new Date(utcDateString);
    // Créer une date en heure locale (navigateur gère automatiquement CEST/CET)
    return new Date(utcDate.getTime());
}

// Gestion des erreurs globales
window.addEventListener('error', function(event) {
    console.error('Erreur JavaScript:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promise rejetée:', event.reason);
});