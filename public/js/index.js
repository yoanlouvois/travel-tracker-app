console.log("index.js chargé")

// ===== Layout toggle (sidebar) =====
const mainLayout = document.getElementById('mainLayout')
const btnMenu = document.getElementById('btnMenu')
const btnCloseMenu = document.getElementById('btnCloseMenu')

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

// ===== Init modules =====
// initPlaces avant initVisitedCountriesMode : le panneau pays lit PlacesApi
window.initPlaces(map)
window.initVisitedCountriesMode(map)
window.initRoadtrips(map)
window.initInfoPanel(map)
window.initSearch(map)

// ===== Listeners =====
btnMenu.addEventListener('click', () => {
  const isOpen = mainLayout.classList.contains('sidebar-open')
  setSidebar(!isOpen)
})

btnCloseMenu.addEventListener('click', () => setSidebar(false))

// ===== Side Bar functions =====
function setSidebar(open) {
  mainLayout.classList.toggle('sidebar-open', open)
  setTimeout(() => map.invalidateSize(), 200)
}