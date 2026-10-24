# Travel Map

**Travel Map** is a desktop travel journal built around an interactive world map.
Mark the countries you have visited or want to visit, pin your favourite places, draw your roadtrips and keep your photos, videos and vlogs in one place.

Everything stays **on your computer**: no account, no cloud, no tracking.

---

<table>
  <tr>
    <td align="center" width="50%">
      <img src="LIEN_IMAGE_CARTE" alt="World map with visited countries and places" width="100%" />
      <br />
      <sub><b>The world map</b> — visited and to-visit countries, places and roadtrips</sub>
    </td>
    <td align="center" width="50%">
      <img src="LIEN_IMAGE_MONTREAL" alt="Info panel opened on Montréal" width="100%" />
      <br />
      <sub><b>Info panel</b> — click a place (here Montréal) to see and edit it</sub>
    </td>
  </tr>
</table>

---

## Features

**Map**
- Interactive world map (Leaflet + OpenStreetMap)
- Mark countries as **visited** or **to visit** (two shades of green)
- Add your own places: cities, hikes, activities, viewpoints…
- **Place search** (OpenStreetMap / Nominatim): find a place by name and add it in one click
- Draw **roadtrips** by linking places together
- Filters by status, place type, roadtrips and countries
- Info panel to view and edit a country, a place or a roadtrip without leaving the map

**Photos & videos**
- Photo and video gallery for every place (JPG, PNG, WebP, MP4, WebM)
- **iPhone photos (HEIC)** accepted and converted to JPEG automatically
- Cover image for every country
- Full-screen viewer

**Pages**
- **My countries**: your visited countries, each with its cover, status, statistics and places
- **Place page**: photo strip, editable details and coordinates
- **My roadtrips**: every stop in order, with dates and photos
- **My vlogs**: your travel videos (YouTube, Vimeo or video files) linked to countries

**Your data**
- Stored locally in a SQLite database
- **Export / import** as a JSON file (backup, move to another PC)

---

## Installation (Windows)

### 1. Download the installer

Go to the [**Releases**](https://github.com/<your-github-user>/WorldTracker/releases/latest) page and download
**`Travel Map Setup x.y.z.exe`** from the **Assets** section.

### 2. Run the installer

Double-click the file and follow the steps. You can choose the installation folder; a desktop shortcut is created.

> **"Windows protected your PC"**
> The app is not code-signed (signing certificates are paid), so Windows SmartScreen may block it the first time.
> Click **More info** → **Run anyway**.

### 3. First launch

Open **Travel Map** from the Start menu or the desktop shortcut.

On the first launch the app creates its database with the list of countries — you can start right away.
An internet connection is only needed for the map background and the place search.

> 💡 The window is too big or too small? Use **Ctrl + mouse wheel** (or **Ctrl +** / **Ctrl −**, **Ctrl 0** to reset).
> The zoom level is remembered.

---

## Using Travel Map

> The interface is in French. Button names are shown as they appear in the app, with a translation when useful.

### The map

The map is the home screen.

- **Toolbar** (right side): the tools to mark countries, add places, draw roadtrips and delete.
  Only one tool is active at a time; click it again to turn it off.
- **Side menu** (**Menu** button, top left):
  - **search** a place by name,
  - **filters**: show or hide visited / to-visit places, each place type, roadtrips and countries,
  - **Données** (*Data*): export and import your data.
- **Info panel** (right side): click a country, a place or a roadtrip to open it.
  You can edit it directly there, then follow the link to its full page.
- **Header**: **Mes pays** (*My countries*), **Mes roadtrips**, **Mes vlogs**; the title brings you back to the map.

### Countries

**Mark a country as visited or to visit**

- Select the **visited** or **to visit** tool in the toolbar, then click countries on the map, **or**
- click a country with no tool selected and choose its status in the info panel:
  **Pas visité** (*not visited*), **À visiter** (*to visit*), **Visité** (*visited*).

Visited countries appear in dark green, countries to visit in light green.

**Mes pays** (*My countries*, in the header) lists your visited countries in alphabetical order, with a search field.
A country page shows its cover, its status (editable), a few statistics and all your places in that country.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="LIEN_IMAGE_MES_PAYS" alt="My countries page" width="100%" />
      <br />
      <sub><b>Mes pays</b> — all your visited countries</sub>
    </td>
    <td align="center" width="50%">
      <img src="LIEN_IMAGE_UN_PAYS" alt="Country page" width="100%" />
      <br />
      <sub><b>Country page</b> — cover, status, statistics and places</sub>
    </td>
  </tr>
</table>

### Places

There are two ways to add a place.

**By clicking on the map**
1. Select the **place** tool in the toolbar.
2. Click the exact spot on the map.
3. The info panel opens: give the place a name, a type (city, hike, activity, viewpoint…), a status, a visit date and a description, then click **Enregistrer** (*Save*).

**With the search**
1. Open the side menu and type a name (e.g. *Montréal*), then press **Enter**.
2. Click a result to see it on the map.
3. Click **Ajouter ce lieu** (*Add this place*), choose its type and status, and confirm.

**The place page**

Every place has its own page (link **Voir la fiche du lieu** in the info panel, or from a country page).
It shows all its photos and videos in a strip (scroll with the arrows or the mouse wheel, click to open full-screen), then its details: name, type, status, visit date, description and coordinates.

<p align="center">
  <img src="LIEN_IMAGE_LIEU" alt="Place page" width="80%" />
  <br />
  <sub><b>Place page</b> — photo strip and editable details</sub>
</p>

To delete a place, use the **delete** tool and click the place, or use **Supprimer ce lieu** (*Delete this place*) in its info panel.
Its photos are deleted with it.

### Roadtrips

**Create a roadtrip**

1. Select the **roadtrip** tool in the toolbar.
2. Click the stops **in order**: an existing place, or anywhere on a country (a new place is created there).
   The info panel shows the stops as you go.
3. Finish with **Terminer le roadtrip** (*Finish*) in the panel, or **double-click** on the map.
   **Échap** (*Esc*) cancels the roadtrip in progress.
4. The new roadtrip opens in the info panel: give it a name, a description and dates.

**Mes roadtrips** (*My roadtrips*, in the header) lists your roadtrips. A roadtrip page shows every stop in order, with the visit date and a photo carousel for each one.

<p align="center">
  <img src="LIEN_IMAGE_ROADTRIP" alt="Roadtrip page" width="80%" />
  <br />
  <sub><b>Roadtrip page</b> — stops in order with dates and photos</sub>
</p>

A roadtrip needs at least 2 stops. Stops can be removed later from its page (**Retirer l'étape**); the place itself is kept.

### Photos and covers

**Photos and videos of a place**
1. Open the place page (link **Voir la fiche du lieu** in the info panel, or from a country page).
2. Click **Ajouter** (*Add*), then choose or drag & drop your files — up to 30 at a time.
3. Click **Envoyer** (*Send*).

Photos: JPG, PNG, WebP or **HEIC** (iPhone, converted to JPEG automatically), 20 MB max each.
Videos: MP4 or WebM, 500 MB max each.
Hover a photo and click the bin icon to delete it.

**Cover of a country**
On the country page, click **Changer la couverture** (*Change cover*), choose an image and click **Enregistrer**.
Without a cover, the country flag is used as background.

### Vlogs

**Mes vlogs** (*My vlogs*, in the header) gathers your travel videos — YouTube or Vimeo links, or video files — and links each vlog to one or more countries.

## Backup and data
 
### Where is my data?
 
Everything is stored on your computer, in your user folder:
 
```
%AppData%\Travel Map\
├─ travel-map.db     # countries, places, roadtrips and vlogs
├─ uploads\          # photos, videos and country covers
└─ window.json       # window zoom level
```
 
To open it: press **Win + R**, type `%AppData%\Travel Map` and press **Enter**.
 
### Export / import
 
In the side menu, section **Données** (*Data*):
 
- **Exporter** (*Export*) saves all your data in a `.json` file.
- **Importer** (*Import*) loads a `.json` file. The import **adds** what is missing (countries' status, places, photos, roadtrips, vlogs) and never deletes anything; if the file is invalid, nothing is imported.
> ⚠️ The JSON file contains the **paths** of your photos, not the photos themselves.
> Keep a copy of the `uploads\` folder with it.
 
### Move to another PC
 
The simplest way:
 
1. Close Travel Map on both PCs.
2. Copy the whole `%AppData%\Travel Map\` folder from the old PC.
3. Install Travel Map on the new PC, launch it once, close it.
4. Replace its `%AppData%\Travel Map\` folder with your copy.
With export / import instead (to merge data into an existing installation):
 
1. On the old PC, **export** your data and copy the `%AppData%\Travel Map\uploads\` folder.
2. On the new PC, paste the content of `uploads\` into `%AppData%\Travel Map\uploads\`, then **import** the JSON file.
---
 
## Update
 
1. **Export** your data, just in case.
2. Close Travel Map.
3. Download the latest installer from the [**Releases**](https://github.com/<your-github-user>/WorldTracker/releases/latest) page and run it.
The new version replaces the old one. Your data in `%AppData%\Travel Map\` is kept, and the database is updated automatically on the next launch if needed.
 
---
 
## Uninstall
 
1. Close Travel Map.
2. **Settings** → **Apps** → **Installed apps** → **Travel Map** → **Uninstall**.
Uninstalling does **not** delete your data. To erase everything, also delete the folder `%AppData%\Travel Map\` (**Win + R**, type `%AppData%`, then delete the `Travel Map` folder).
 
---
 
## Development
 
### Tech stack
 
- **Front-end**: HTML, CSS, vanilla JavaScript, Bootstrap 5, Leaflet
- **Back-end**: Node.js, Express 5, Prisma 7, SQLite (better-sqlite3)
- **Desktop**: Electron, electron-builder (NSIS installer)
- **Place search**: OpenStreetMap Nominatim
### Run locally
 
**Prerequisites**: [Node.js](https://nodejs.org/) 22 or later, [Git](https://git-scm.com/).
 
```bash
git clone https://github.com/<your-github-user>/WorldTracker.git
cd WorldTracker
npm install                 # also generates the Prisma client
```
 
Create the `.env` file (see below), then the database:
 
```bash
npx prisma migrate dev      # creates the SQLite database
npm run seed:countries      # fills the country list
npm start
```
 
Open `http://localhost:8080`. Uploaded files go to `public/uploads/`.
 
### Environment variables
 
Copy `.env.example` to `.env`:
 
```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```
 
| Variable               | Required | Description                                            |
|------------------------|----------|--------------------------------------------------------|
| `DATABASE_URL`         | yes      | Development database, e.g. `file:./dev.db`              |
| `NOMINATIM_USER_AGENT` | yes      | Identifies the app to Nominatim (place search)          |
| `NOMINATIM_EMAIL`      | no       | Contact e-mail sent to Nominatim (recommended)          |
| `UPLOADS_DIR`          | no       | Upload folder (default: `public/uploads`)               |
| `PORT`                 | no       | Server port for `npm start` (default: `8080`)           |
 
### Run as a desktop app
 
```bash
npm run db:template         # once: builds build/template.db
npm run app
```
 
Opens the Electron window. It uses the same data folder as the installed app (`%AppData%\Travel Map\`).
 
### Build the installer
 
```bash
npm run dist
```
 
The installer is created in `dist/Travel Map Setup x.y.z.exe` (`dist/win-unpacked/` contains the app without installer, for testing).
 
Releases are also built by **GitHub Actions** (`.github/workflows/release.yml`) when a version tag is pushed. The tag must match `version` in `package.json`:
 
```bash
git tag v1.1.0
git push origin v1.1.0
```
 
### Project structure
 
```
WorldTracker/
├─ package.json              # scripts (start, app, dist…) + electron-builder config
├─ prisma.config.ts          # Prisma 7 config
├─ .env.example              # environment variables template
├─ .github/workflows/
│  └─ release.yml            # builds the installer and publishes a release on tag
│
├─ prisma/
│  ├─ schema.prisma          # data model (client generated in src/generated/prisma)
│  └─ migrations/            # SQL migrations (shipped with the app)
│
├─ electron/                 # desktop app
│  ├─ main.js                # data in %AppData%, local server on 127.0.0.1, window, zoom
│  └─ migrate.js             # applies migrations on startup
│
├─ scripts/
│  ├─ seed-countries.js      # fills the Country table from the GeoJSON
│  ├─ build-template-db.js   # builds build/template.db (migrated database + countries)
│  └─ native.js              # better-sqlite3 binary for Electron or Node
│
├─ shared/
│  └─ isoCodes.js            # ISO2 <-> ISO3 country codes
│
├─ src/                      # back-end (Express + Prisma)
│  ├─ server.js              # starts the server
│  ├─ app.js                 # middlewares, static files, /uploads, JSON errors
│  ├─ prisma.js              # Prisma client + better-sqlite3 adapter
│  ├─ routes.js              # all /api routes
│  ├─ controllers/           # HTTP layer: countries, places, trips, vlogs, media,
│  │                         # geocode, backup, stats
│  ├─ services/              # business logic + database
│  └─ upload/
│     ├─ multer.js           # accepted types and size limits
│     ├─ heic.js             # HEIC -> JPEG conversion
│     └─ files.js            # upload paths and file deletion
│
└─ public/                   # front-end
   ├─ index.html             # map + side menu
   ├─ country.html           # My countries / country page
   ├─ place.html             # place page
   ├─ roadtrip.html          # My roadtrips / roadtrip page
   ├─ vlogs.html             # My vlogs / vlog page
   ├─ countries.geo.json     # country borders (map + seed)
   ├─ css/style.css
   ├─ panels/                # info panel templates (country, place, roadtrip)
   ├─ js/
   │  ├─ api.js              # calls to the /api routes (incl. uploads with progress)
   │  ├─ index.js            # map page start-up
   │  ├─ infoPanel.js        # info panel
   │  ├─ search.js           # place search
   │  ├─ backup.js           # export / import
   │  ├─ country.js, place.js, roadtrip.js, vlogs.js   # pages
   │  └─ map/                # map modules: tools, countries, places, roadtrips
   └─ resources/             # flags (fr.png, mc.png…)
```
 
Not versioned: `.env`, `prisma/dev.db`, `src/generated/`, `build/template.db`, `dist/`, `public/uploads/`.
