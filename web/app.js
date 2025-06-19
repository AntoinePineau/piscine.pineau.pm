// Configuration
const API_BASE_URL = '/api';
const UPDATE_INTERVAL = 30000; // 30 secondes
const CHART_COLORS = {
    ph: '#9C27B0',
    temperature: '#FF5722', 
    redox: '#FF9800',
    salt: '#607D8B'
};

// Variables globales
let updateTimer;
let charts = {};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('Initialisation de Pool Monitor...');
    
    // Configuration des événements
    setupEventListeners();
    
    // Chargement initial des données
    await loadLatestData();
    await loadStats();
    await loadChartData();
    
    // Démarrage des mises à jour automatiques
    startAutoUpdate();
    
    console.log('Pool Monitor initialisé');
}

function setupEventListeners() {
    // Contrôles des graphiques
    document.getElementById('time-range').addEventListener('change', loadChartData);
    document.getElementById('chart-interval').addEventListener('change', loadChartData);
    document.getElementById('refresh-charts').addEventListener('click', () => {
        loadLatestData();
        loadStats();
        loadChartData();
    });
}

// Chargement des dernières données
async function loadLatestData() {
    try {
        const response = await fetch(`${API_BASE_URL}/measurements/latest`);
        const result = await response.json();
        
        if (result.success && result.data) {
            updateCurrentValues(result.data);
            updateConnectionStatus(true);
            updateLastUpdateTime(result.data.timestamp);
        } else {
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des dernières données:', error);
        updateConnectionStatus(false);
    }
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
            icon: 'fas fa-info-circle',
            message: 'Système en fonctionnement normal'
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

// Mise à jour du statut de connexion
function updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connection-status');
    if (isOnline) {
        statusElement.className = 'status online';
        statusElement.innerHTML = '<i class="fas fa-circle"></i> En ligne';
    } else {
        statusElement.className = 'status offline';
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Hors ligne';
    }
}

// Mise à jour de l'heure de dernière mise à jour
function updateLastUpdateTime(timestamp) {
    const lastUpdateElement = document.getElementById('last-update');
    const date = new Date(timestamp);
    lastUpdateElement.textContent = `Dernière mise à jour: ${date.toLocaleString('fr-FR')}`;
}

// Chargement des statistiques
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/measurements/stats?hours=24`);
        const result = await response.json();
        
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
    document.getElementById('ph-min').textContent = stats.min_ph ? stats.min_ph.toFixed(2) : '--';
    document.getElementById('ph-avg').textContent = stats.avg_ph ? stats.avg_ph.toFixed(2) : '--';
    document.getElementById('ph-max').textContent = stats.max_ph ? stats.max_ph.toFixed(2) : '--';
    
    // Température
    document.getElementById('temp-min').textContent = stats.min_temperature ? stats.min_temperature.toFixed(1) : '--';
    document.getElementById('temp-avg').textContent = stats.avg_temperature ? stats.avg_temperature.toFixed(1) : '--';
    document.getElementById('temp-max').textContent = stats.max_temperature ? stats.max_temperature.toFixed(1) : '--';
    
    // Redox
    document.getElementById('redox-min').textContent = stats.min_redox ? Math.round(stats.min_redox) : '--';
    document.getElementById('redox-avg').textContent = stats.avg_redox ? Math.round(stats.avg_redox) : '--';
    document.getElementById('redox-max').textContent = stats.max_redox ? Math.round(stats.max_redox) : '--';
    
    // Sel
    document.getElementById('salt-min').textContent = stats.min_salt ? stats.min_salt.toFixed(1) : '--';
    document.getElementById('salt-avg').textContent = stats.avg_salt ? stats.avg_salt.toFixed(1) : '--';
    document.getElementById('salt-max').textContent = stats.max_salt ? stats.max_salt.toFixed(1) : '--';
}

// Chargement des données pour les graphiques
async function loadChartData() {
    try {
        const hours = document.getElementById('time-range').value;
        const interval = document.getElementById('chart-interval').value;
        
        const response = await fetch(`${API_BASE_URL}/measurements/chart-data?hours=${hours}&interval=${interval}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            updateCharts(result.data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données graphiques:', error);
    }
}

// Mise à jour des graphiques
function updateCharts(chartData) {
    // Configuration commune pour tous les graphiques
    const commonConfig = {
        chart: {
            type: 'line',
            backgroundColor: 'transparent'
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
                rotation: -45
            }
        },
        plotOptions: {
            line: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: true
                        }
                    }
                }
            }
        },
        tooltip: {
            shared: true,
            crosshairs: true
        }
    };

    // Graphique pH
    const phSeries = chartData.series.find(s => s.name === 'pH');
    if (phSeries) {
        charts.ph = Highcharts.chart('ph-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'pH' },
                min: 6.5,
                max: 8.0,
                plotBands: [{
                    from: 7.0,
                    to: 7.4,
                    color: 'rgba(76, 175, 80, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#4CAF50' }
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
    if (tempSeries) {
        charts.temperature = Highcharts.chart('temperature-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Température (°C)' },
                plotBands: [{
                    from: 18,
                    to: 28,
                    color: 'rgba(255, 87, 34, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#FF5722' }
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
    if (redoxSeries) {
        charts.redox = Highcharts.chart('redox-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Redox (mV)' },
                plotBands: [{
                    from: 650,
                    to: 750,
                    color: 'rgba(255, 152, 0, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#FF9800' }
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
    if (saltSeries) {
        charts.salt = Highcharts.chart('salt-chart', {
            ...commonConfig,
            yAxis: {
                title: { text: 'Sel (g/L)' },
                plotBands: [{
                    from: 3.0,
                    to: 5.0,
                    color: 'rgba(96, 125, 139, 0.1)',
                    label: {
                        text: 'Zone optimale',
                        style: { color: '#607D8B' }
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
        await loadLatestData();
        await loadStats();
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
        loadLatestData();
        loadStats();
    }
});

// Gestion des erreurs globales
window.addEventListener('error', function(event) {
    console.error('Erreur JavaScript:', event.error);
});

// Fonction utilitaire pour formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}