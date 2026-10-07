# leforem-scraper-frontend

Interface utilisateur statique pour le scraper Le Forem.

## Architecture

```
raw.json (généré par le backend)
    │
    ▼
GitHub Pages — site statique
    │
    ▼
frontend (index.html + js/)
    │
    ▼
localStorage — paramètres utilisateur
```

## Utilisation

### En production (GitHub Pages)

1. Copier `raw.json` (généré par le backend) à la racine de ce dépôt
2. Pousser sur GitHub
3. Configurer GitHub Pages sur la branche principale
4. Ouvrir `https://<user>.github.io/leforem-scraper-frontend/`

### En développement local

```bash
python serveur.py
# Ouvrir http://localhost:8080
```

## Structure

```
leforem-scraper-frontend/
├── index.html          # Page principale
├── site.config.json    # Configuration (dataUrl, base)
├── serveur.py          # Serveur local pour le développement
├── js/                 # Modules JavaScript
│   ├── shared/         # Modules communs (api, storage, profile, paths)
│   └── pages/          # Pages (index, detail, profil, companies, insights)
├── html/               # Pages HTML
└── css/                # Feuilles de style
```

## Dépendances

Aucune dépendance Python pour le frontend. Le serveur local utilise
uniquement la bibliothèque standard Python.

## Paramètres utilisateur

Les paramètres utilisateur sont stockés dans `localStorage` :
- Profil candidat (`forem_profil`)
- Suivi des offres (`forem_<base>_statuts`, `_remarques`, `_favoris`, etc.)
- Thème (`forem_theme`)
- Sélection de recherche (`forem_scraping_select`)

## Mise à jour des données

Pour mettre à jour les offres affichées :

1. Lancer le scraping depuis le backend
2. Copier `raw.json` du backend vers la racine de ce dépôt
3. Pousser sur GitHub
