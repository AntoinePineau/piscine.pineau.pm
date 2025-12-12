# Variables d'environnement à configurer sur Vercel

Allez sur : https://vercel.com/[votre-projet]/settings/environment-variables

Et ajoutez ces variables (pour l'environnement **Production**) :

## 1. Google Drive & Service Account

### GOOGLE_SERVICE_ACCOUNT_KEY
```
{"type": "service_account", "project_id": "piscine-pineau-pm", ...}
```
(Copier tout le contenu depuis le fichier `.env`)

### GOOGLE_DRIVE_FOLDER_ID
```
11JpXWOH5P-WObbSoLdAtVHV82yWTdA5X
```

### DRIVE_FILE_MEASUREMENTS_ID
```
1ubqc6qthRCYtHwsH_b1sasocut6HZYzC
```

### DRIVE_FILE_DAILY_AVERAGES_ID
```
1dzmp1pGPzSHlm_sobCzkeTKXyp1vFqMS
```

### DRIVE_FILE_ERROR_LOGS_ID
```
13ypAraAjjYGEECTTtt3X4w69grJthCPq
```

### DRIVE_FILE_ALERTS_ID
```
1bLaKukLe3DJy5u5fQvvuaxMhyMOf4C3F
```

## 2. Gemini AI

### GEMINI_API_KEY
```
AIzaSyCXbWba9eKZvC7iS6ZCkLya0k1PzyNZOHM
```

## 3. Email Configuration

### EMAIL_PROVIDER
```
gmail
```

### GMAIL_USER
```
antoine@pineau.pm
```

### GMAIL_APP_PASSWORD
```
avrb jxzv eyhm ohho
```

### EMAIL_TO
```
piscine@pineau.pm
```

## 4. Application

### FRONTEND_URL
```
https://piscine.pineau.pm
```

### CRON_SECRET
```
ç@FéSpl1sh&çaFéSpl0ush
```

---

## 📋 Checklist

- [ ] Toutes les variables ajoutées dans Vercel
- [ ] Environment: **Production** sélectionné
- [ ] Redéployer le projet après avoir ajouté les variables
- [ ] Tester l'API : `https://[votre-domaine].vercel.app/api/health`

---

**Note** : Les variables sont déjà dans votre fichier `.env` local. Il suffit de les copier-coller une par une dans Vercel.

Une fois fait, Vercel redéploiera automatiquement votre application !
