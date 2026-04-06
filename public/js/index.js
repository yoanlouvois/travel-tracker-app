console.log("index.js chargé")

// ===== Layout toggle (sidebar) =====
const mainLayout = document.getElementById('mainLayout')
const btnMenu = document.getElementById('btnMenu')
const btnCloseMenu = document.getElementById('btnCloseMenu')

function setSidebar(open) {
  mainLayout.classList.toggle('sidebar-open', open)

  // Leaflet: IMPORTANT -> quand la taille du conteneur change, il faut recalculer
  // sinon carte grise/bug d'affichage
  setTimeout(() => map.invalidateSize(), 200)
}

btnMenu.addEventListener('click', () => {
  const isOpen = mainLayout.classList.contains('sidebar-open')
  setSidebar(!isOpen)
})

btnCloseMenu.addEventListener('click', () => setSidebar(false))

// ===== Map init =====
const map = L.map('map').setView([48.8566, 2.3522], 4)
console.log("Leaflet OK, map initialisée")

L.tileLayer(
  'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap &copy; Stadia Maps',
    maxZoom: 19,
    minZoom: 3, 
  }
).addTo(map)

const southWest = L.latLng(-85, -180)
const northEast = L.latLng(85, 180)
const bounds = L.latLngBounds(southWest, northEast)

map.setMaxBounds(bounds)
map.on('drag', () => map.panInsideBounds(bounds, { animate: false }))

// Init mode "pays visités" (chargement GeoJSON + interactions)
window.initPlaces(map)
window.initVisitedCountriesMode(map)
window.initRoadtrips(map)

// ===== Search (pas de logique encore) =====
document.getElementById('btnSearch').addEventListener('click', () => {
  const q = document.getElementById('searchInput').value.trim()
  console.log("Recherche:", q)
})

