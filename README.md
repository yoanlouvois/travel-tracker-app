# Travel Map

**Travel Map** est une application qui permet de suivre et documenter ses voyages sur une carte du monde interactive.

Elle permet de marquer les pays visités ou à visiter, d'enregistrer des lieux (villes, randonnées, points de vue…), de retracer des roadtrips en reliant ces lieux, et d'associer à chaque lieu ses photos et vidéos. Les vlogs de voyage peuvent également être rattachés aux pays correspondants. 

Toutes les données sont stockées **localement** sur l'ordinateur : aucun compte, aucun service en ligne, aucune collecte de données.

---

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/0ce96745-6d08-45f0-99d1-ed5148deaa0e" alt="Carte du monde avec les pays et lieux visités" width="100%" />
      <br />
      <sub><b>La carte du monde</b> — pays visités et à visiter, lieux et roadtrips</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/505545f9-72d6-4edd-a9b0-1d4d6bad71b2" alt="Panneau d'info ouvert sur Montréal" width="100%" />
      <br />
      <sub><b>Le panneau d'info</b> — cliquez sur un lieu (ici Montréal) pour le voir et le modifier</sub>
    </td>
  </tr>
</table>

---

## Fonctionnalités

**Carte**
- Carte du monde interactive (Leaflet + OpenStreetMap)
- Pays marqués comme **visités** ou **à visiter** (Vert ou Rouge)
- Ajout de vos propres lieux : villes, randonnées, activités, points de vue…
- **Recherche de lieux** (OpenStreetMap / Nominatim) : trouvez un lieu par son nom et ajoutez-le en un clic
- **Roadtrips** tracés en reliant des lieux entre eux
- Filtres par statut, type de lieu, roadtrips et pays
- Panneau d'info pour voir et modifier un pays, un lieu ou un roadtrip sans quitter la carte

**Photos et vidéos**
- Galerie de photos et de vidéos pour chaque lieu (JPG, PNG, WebP, MP4, WebM)
- **Photos d'iPhone (HEIC)** acceptées et converties automatiquement en JPEG
- Image de couverture pour chaque pays
- Visionneuse plein écran

**Pages**
- **Mes pays** : vos pays visités, chacun avec sa couverture, son statut, ses chiffres et ses lieux
- **Fiche d'un lieu** : bande de photos, infos et coordonnées modifiables
- **Mes roadtrips** : toutes les étapes dans l'ordre, avec les dates et les photos
- **Mes vlogs** : vos vidéos de voyage (YouTube, Vimeo ou fichiers vidéo) reliées aux pays

**Vos données**
- Enregistrées sur votre ordinateur dans une base SQLite
- **Export / import** en fichier JSON (sauvegarde, changement de PC)

---

## Installation (Windows)

### 1. Télécharger l'installateur

Rendez-vous sur la page [**Releases**](https://github.com/<your-github-user>/WorldTracker/releases/latest) et téléchargez
**`Travel Map Setup x.y.z.exe`** dans la partie **Assets**.

### 2. Lancer l'installateur

Double-cliquez sur le fichier et suivez les étapes. Vous pouvez choisir le dossier d'installation ; un raccourci est créé sur le bureau.

> **« Windows a protégé votre ordinateur »**
> L'app n'est pas signée (les certificats de signature sont payants), donc Windows SmartScreen peut la bloquer la première fois.
> Cliquez sur **Informations complémentaires** → **Exécuter quand même**.

### 3. Premier lancement

Ouvrez **Travel Map** depuis le menu Démarrer ou le raccourci du bureau.

Au premier lancement, l'app crée sa base de données avec la liste des pays : vous pouvez commencer tout de suite.
Une connexion internet n'est nécessaire que pour le fond de carte et la recherche de lieux.

> 💡 La fenêtre est trop grande ou trop petite ? Utilisez **Ctrl + molette** (ou **Ctrl +** / **Ctrl −**, et **Ctrl 0** pour revenir à la normale).
> Le niveau de zoom est mémorisé.

---

## Utilisation

### La carte

La carte est l'écran d'accueil.

- **Barre d'outils** (à droite) : les outils pour marquer les pays, ajouter des lieux, tracer des roadtrips et supprimer.
  Un seul outil est actif à la fois ; cliquez de nouveau dessus pour le désactiver.
- **Menu latéral** (bouton **Menu**, en haut à gauche) :
  - **recherche** d'un lieu par son nom ;
  - **filtres** : afficher ou masquer les lieux visités / à visiter, chaque type de lieu, les roadtrips et les pays ;
  - **Données** : export et import de vos données.
- **Panneau d'info** (à droite) : cliquez sur un pays, un lieu ou un roadtrip pour l'ouvrir.
  Vous pouvez le modifier directement, puis suivre le lien vers sa fiche complète.
- **En-tête** : **Mes pays**, **Mes roadtrips**, **Mes vlogs** ; le titre ramène à la carte.

### Pays

**Marquer un pays comme visité ou à visiter**

- Sélectionnez l'outil **visité** ou **à visiter** dans la barre d'outils, puis cliquez sur les pays de la carte, **ou**
- cliquez sur un pays sans outil sélectionné et choisissez son statut dans le panneau d'info :
  **Pas visité**, **À visiter** ou **Visité**.

Les pays visités s'affichent en vert foncé, les pays à visiter en vert clair.

**Mes pays** (dans l'en-tête) liste vos pays visités par ordre alphabétique, avec un champ de recherche.
La fiche d'un pays affiche sa couverture, son statut (modifiable), quelques chiffres et tous vos lieux dans ce pays.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/702deb13-1636-4cd6-a440-8561d3dfdedc" alt="Page Mes pays" width="100%" />
      <br />
      <sub><b>Mes pays</b> — tous vos pays visités</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/3535a887-797d-46db-92eb-24a29f2675d1" alt="Fiche d'un pays" width="100%" />
      <br />
      <sub><b>Fiche d'un pays</b> — couverture, statut, chiffres et lieux</sub>
    </td>
  </tr>
</table>

### Lieux

Il y a deux façons d'ajouter un lieu.

**En cliquant sur la carte**
1. Sélectionnez l'outil **lieu** dans la barre d'outils.
2. Cliquez à l'endroit exact sur la carte.
3. Le panneau d'info s'ouvre : donnez au lieu un nom, un type (ville, randonnée, activité, point de vue…), un statut, une date de visite et une description, puis cliquez sur **Enregistrer**.

**Avec la recherche**
1. Ouvrez le menu latéral, tapez un nom (par exemple *Montréal*), puis appuyez sur **Entrée**.
2. Cliquez sur un résultat pour le voir sur la carte.
3. Cliquez sur **Ajouter ce lieu**, choisissez son type et son statut, puis validez.

**La fiche d'un lieu**

Chaque lieu a sa propre fiche (lien **Voir la fiche du lieu** dans le panneau d'info, ou depuis la fiche d'un pays).
Elle affiche toutes ses photos et vidéos dans une bande (défilement avec les flèches ou la molette, clic pour ouvrir en plein écran), puis ses infos : nom, type, statut, date de visite, description et coordonnées.

<p align="center">
  <img src="https://github.com/user-attachments/assets/4d307c12-7395-4b14-bf79-d8d233f0cd50" alt="Fiche d'un lieu" width="80%" />
  <br />
  <sub><b>Fiche d'un lieu</b> — bande de photos et infos modifiables</sub>
</p>

Pour supprimer un lieu, utilisez l'outil **supprimer** puis cliquez sur le lieu, ou le bouton **Supprimer ce lieu** dans son panneau d'info.
Ses photos sont supprimées avec lui.

### Roadtrips

**Créer un roadtrip**

1. Sélectionnez l'outil **roadtrip** dans la barre d'outils.
2. Cliquez sur les étapes **dans l'ordre** : un lieu existant, ou n'importe où sur un pays (un nouveau lieu y est créé).
   Le panneau d'info affiche les étapes au fur et à mesure.
3. Terminez avec **Terminer le roadtrip** dans le panneau, ou par un **double-clic** sur la carte.
   **Échap** annule le roadtrip en cours.
4. Le nouveau roadtrip s'ouvre dans le panneau d'info : donnez-lui un nom, une description et des dates.

**Mes roadtrips** (dans l'en-tête) liste vos roadtrips. La fiche d'un roadtrip affiche toutes les étapes dans l'ordre, avec la date de visite et un carrousel de photos pour chacune.

<p align="center">
  <img src="https://github.com/user-attachments/assets/3205ee50-6dfb-4c0e-a7d9-5d5d09d84533" alt="Fiche d'un roadtrip" width="80%" />
  <br />
  <sub><b>Fiche d'un roadtrip</b> — étapes dans l'ordre, avec les dates et les photos</sub>
</p>

Un roadtrip doit avoir au moins 2 étapes. Une étape peut être retirée plus tard depuis sa fiche (**Retirer l'étape**) ; le lieu, lui, est conservé.

### Photos et couvertures

**Photos et vidéos d'un lieu**
1. Ouvrez la fiche du lieu (lien **Voir la fiche du lieu** dans le panneau d'info, ou depuis la fiche d'un pays).
2. Cliquez sur **Ajouter**, puis choisissez ou glissez vos fichiers, jusqu'à 30 à la fois.
3. Cliquez sur **Envoyer**.

Photos : JPG, PNG, WebP ou **HEIC** (iPhone, converties automatiquement en JPEG), 20 Mo maximum chacune.
Vidéos : MP4 ou WebM, 500 Mo maximum chacune.
Survolez une photo et cliquez sur la poubelle pour la supprimer.

**Couverture d'un pays**

Sur la fiche du pays, cliquez sur **Changer la couverture**, choisissez une image puis cliquez sur **Enregistrer**.
Sans couverture, c'est le drapeau du pays qui sert de fond.

### Vlogs

**Mes vlogs** (dans l'en-tête) regroupe vos vidéos de voyage, liens YouTube ou Vimeo ou fichiers vidéo, et relie chaque vlog à un ou plusieurs pays.

---

## Sauvegarde et données

### Où sont mes données ?

Tout est enregistré sur votre ordinateur, dans votre dossier utilisateur :

```
%AppData%\Travel Map\
├─ travel-map.db     # pays, lieux, roadtrips et vlogs
├─ uploads\          # photos, vidéos et couvertures des pays
└─ window.json       # niveau de zoom de la fenêtre
```

Pour l'ouvrir : appuyez sur **Win + R**, tapez `%AppData%\Travel Map` puis **Entrée**.

### Export / import

Dans le menu latéral, partie **Données** :

- **Exporter** enregistre toutes vos données dans un fichier `.json`.
- **Importer** charge un fichier `.json`. L'import **ajoute** ce qui manque (statut des pays, lieux, photos, roadtrips, vlogs) et ne supprime jamais rien ; si le fichier n'est pas valide, rien n'est importé.

> ⚠️ Le fichier JSON contient les **chemins** de vos photos, pas les photos elles-mêmes.
> Gardez une copie du dossier `uploads\` avec lui.

### Changer de PC

La méthode la plus simple :

1. Fermez Travel Map sur les deux PC.
2. Copiez tout le dossier `%AppData%\Travel Map\` de l'ancien PC.
3. Installez Travel Map sur le nouveau PC, lancez-la une fois, puis fermez-la.
4. Remplacez son dossier `%AppData%\Travel Map\` par votre copie.

Avec l'export / import (pour fusionner vos données avec une installation existante) :

1. Sur l'ancien PC, **exportez** vos données et copiez le dossier `%AppData%\Travel Map\uploads\`.
2. Sur le nouveau PC, collez le contenu de `uploads\` dans `%AppData%\Travel Map\uploads\`, puis **importez** le fichier JSON.

---

## Mettre à jour

1. **Exportez** vos données, par précaution.
2. Fermez Travel Map.
3. Téléchargez le dernier installateur sur la page [**Releases**](https://github.com/<your-github-user>/WorldTracker/releases/latest) et lancez-le.

La nouvelle version remplace l'ancienne. Vos données dans `%AppData%\Travel Map\` sont conservées, et la base est mise à jour automatiquement au lancement suivant si besoin.

---

## Désinstaller

1. Fermez Travel Map.
2. **Paramètres** → **Applications** → **Applications installées** → **Travel Map** → **Désinstaller**.

La désinstallation ne supprime **pas** vos données. Pour tout effacer, supprimez aussi le dossier `%AppData%\Travel Map\` (**Win + R**, tapez `%AppData%`, puis supprimez le dossier `Travel Map`).

---

## Développement

### Technologies

- **Front-end** : HTML, CSS, JavaScript natif, Bootstrap 5, Leaflet
- **Back-end** : Node.js, Express 5, Prisma 7, SQLite (better-sqlite3)
- **Application de bureau** : Electron, electron-builder (installateur NSIS)
- **Recherche de lieux** : OpenStreetMap Nominatim

### Lancer en local

**Prérequis** : [Node.js](https://nodejs.org/) 22 ou plus récent, [Git](https://git-scm.com/).

```bash
git clone https://github.com/yoanlouvois/travel-tracker-app.git
cd travel-tracker-app
npm install                 # génère aussi le client Prisma
```

Créez le fichier `.env` (voir ci-dessous), puis la base de données :

```bash
npx prisma migrate dev      # crée la base SQLite
npm run seed:countries      # remplit la liste des pays
npm start
```

Ouvrez `http://localhost:8080`. Les fichiers envoyés sont enregistrés dans `public/uploads/`.

### Variables d'environnement

Copiez `.env.example` en `.env` :

```bash
cp .env.example .env        # PowerShell : Copy-Item .env.example .env
```

| Variable               | Obligatoire | Description                                              |
|------------------------|-------------|----------------------------------------------------------|
| `DATABASE_URL`         | oui         | Base de développement, par exemple `file:./dev.db`        |
| `NOMINATIM_USER_AGENT` | oui         | Identifie l'app auprès de Nominatim (recherche de lieux)  |
| `NOMINATIM_EMAIL`      | non         | E-mail de contact envoyé à Nominatim (conseillé)          |
| `UPLOADS_DIR`          | non         | Dossier des fichiers envoyés (par défaut `public/uploads`)|
| `PORT`                 | non         | Port du serveur pour `npm start` (par défaut `8080`)      |

### Lancer la version bureau

```bash
npm run db:template         # une seule fois : crée build/template.db
npm run app
```

Cette commande ouvre la fenêtre Electron, qui utilise le même dossier de données que l'app installée (`%AppData%\Travel Map\`).

### Construire l'installateur

```bash
npm run dist
```

L'installateur est créé dans `dist/Travel Map Setup x.y.z.exe` (`dist/win-unpacked/` contient l'app sans installation, pour les tests).

Les releases sont aussi construites par **GitHub Actions** (`.github/workflows/release.yml`) quand un tag de version est poussé. Le tag doit correspondre au champ `version` de `package.json` :

```bash
git tag v1.1.0
git push origin v1.1.0
```

### Arborescence du projet

```
travel-tracker-app/
├─ package.json              # scripts (start, app, dist…) + config electron-builder
├─ prisma.config.ts          # config Prisma 7
├─ .env.example              # modèle des variables d'environnement
├─ .github/workflows/
│  └─ release.yml            # construit l'installateur et publie une release sur un tag
│
├─ prisma/
│  ├─ schema.prisma          # modèle de données (client généré dans src/generated/prisma)
│  └─ migrations/            # migrations SQL (embarquées dans l'app)
│
├─ electron/                 # application de bureau
│  ├─ main.js                # données dans %AppData%, serveur local sur 127.0.0.1, fenêtre, zoom
│  └─ migrate.js             # applique les migrations au démarrage
│
├─ scripts/
│  ├─ seed-countries.js      # remplit la table Country depuis le GeoJSON
│  ├─ build-template-db.js   # crée build/template.db (base migrée + pays)
│  └─ native.js              # binaire better-sqlite3 pour Electron ou Node
│
├─ shared/
│  └─ isoCodes.js            # codes pays ISO2 <-> ISO3
│
├─ src/                      # back-end (Express + Prisma)
│  ├─ server.js              # démarre le serveur
│  ├─ app.js                 # middlewares, fichiers statiques, /uploads, erreurs JSON
│  ├─ prisma.js              # client Prisma + adaptateur better-sqlite3
│  ├─ routes.js              # toutes les routes /api
│  ├─ controllers/           # couche HTTP : countries, places, trips, vlogs, media,
│  │                         # geocode, backup, stats
│  ├─ services/              # logique métier + base de données
│  └─ upload/
│     ├─ multer.js           # types acceptés et tailles maximales
│     ├─ heic.js             # conversion HEIC -> JPEG
│     └─ files.js            # chemins des fichiers envoyés et suppression
│
└─ public/                   # front-end
   ├─ index.html             # carte + menu latéral
   ├─ country.html           # Mes pays / fiche d'un pays
   ├─ place.html             # fiche d'un lieu
   ├─ roadtrip.html          # Mes roadtrips / fiche d'un roadtrip
   ├─ vlogs.html             # Mes vlogs / fiche d'un vlog
   ├─ countries.geo.json     # frontières des pays (carte + seed)
   ├─ css/style.css
   ├─ panels/                # modèles du panneau d'info (pays, lieu, roadtrip)
   ├─ js/
   │  ├─ api.js              # appels aux routes /api (dont l'envoi de fichiers avec progression)
   │  ├─ index.js            # démarrage de la page carte
   │  ├─ infoPanel.js        # panneau d'info
   │  ├─ search.js           # recherche de lieux
   │  ├─ backup.js           # export / import
   │  ├─ country.js, place.js, roadtrip.js, vlogs.js   # pages
   │  └─ map/                # modules de la carte : outils, pays, lieux, roadtrips
   └─ resources/             # drapeaux (fr.png, mc.png…)
```

Non versionnés : `.env`, `prisma/dev.db`, `src/generated/`, `build/template.db`, `dist/`, `public/uploads/`.
