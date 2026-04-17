console.log("index.js chargé")

// ===== Layout toggle (sidebar) =====
const mainLayout = document.getElementById('mainLayout')
const btnMenu = document.getElementById('btnMenu')
const btnCloseMenu = document.getElementById('btnCloseMenu')

// ==== Ecran d'info ======
const infoPanel = document.getElementById('infoPanel')
const btnCloseInfoPanel = document.getElementById('btnCloseInfoPanel')
const infoPanelTitle = document.getElementById('infoPanelTitle')
const infoPanelContent = document.getElementById('infoPanelContent')

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

// Init modules
window.initPlaces(map)
window.initVisitedCountriesMode(map)
window.initRoadtrips(map)

// ===== Listeners =====
btnMenu.addEventListener('click', () => {
  const isOpen = mainLayout.classList.contains('sidebar-open')
  setSidebar(!isOpen)
})

btnCloseMenu.addEventListener('click', () => setSidebar(false))
btnCloseInfoPanel.addEventListener('click', closeInfoPanel)

document.getElementById('btnSearch').addEventListener('click', () => {
  const q = document.getElementById('searchInput').value.trim()
  console.log("Recherche:", q)
})

// ===== Event open info panel =====
map.on('ui:openInfoPanel', (e) => {
  const type = e.panelType
  const data = e.payload

  console.log('ui:openInfoPanel reçu', type, data)

  if (type === 'country') {
    openInfoPanel({
      title: data?.name || 'Pays',
      content: `
        <p><strong>Code :</strong> ${data?.iso3 ?? '-'}</p>
      `
    })
  }

  if (type === 'place') {
    openInfoPanel({
      title: data?.label || 'Lieu',
      content: `
        <p><strong>Type :</strong> ${data?.type ?? '-'}</p>
        <p><strong>Pays :</strong> ${data?.countryIso2 ?? '-'}</p>
      `
    })
  }
})



// ===== Side Bar functions =====
function setSidebar(open) {
  mainLayout.classList.toggle('sidebar-open', open)
  setTimeout(() => map.invalidateSize(), 200)
}

function openInfoPanel({ title = 'Infos', content = '' } = {}) {
  infoPanelTitle.textContent = title
  infoPanelContent.innerHTML = content || '<p class="text-secondary mb-0">Aucun contenu.</p>'
  infoPanel.classList.add('open')
}

function closeInfoPanel() {
  infoPanel.classList.remove('open')
}