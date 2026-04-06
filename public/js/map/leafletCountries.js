(function () {
  function initVisitedCountriesMode(map) {
    // =============================
    // FRONT STATE
    // =============================
    const visitedCountries = new Set() // ex: "FRA", "CAN", ...
    const toVisitCountries = new Set()

    const uiState = {
      countryPickMode: false, // outil "pays visités" actif ?
      showVisitedCountries: false, // filtre affichage "pays visités"
      countryToVisitPickMode: false, // outil "pays à visiter" actif ?
      showCountriesToVisit: false, // filtre affichage "pays à visiter"
    }

    const filterCountries = document.getElementById('filterCountries')
    const toolCountries = document.getElementById('toolCountries')
    const filterCountriesToVisit = document.getElementById('filterCountriesToVisit')
    const toolCountriesFutur = document.getElementById('toolCountriesFutur')

    // noms d'outils pour ToolManager
    const TOOL_VISITED = 'countriesVisited'
    const TOOL_TOVISIT = 'countriesToVisit'

    let countriesLayer = null

    function getiso3(feature) {
      // ton GeoJSON: id est directement sur la feature
      return feature.id || feature.properties?.id || feature.properties?.iso_a2 || feature.properties?.ISO_A2
    }

    function countryStyle(feature) {
      const iso3 = String(getiso3(feature) || '').toUpperCase()

      const isVisited = visitedCountries.has(iso3)
      const isToVisit = toVisitCountries.has(iso3)

      // Si aucun filtre actif → pas de remplissage
      if (!uiState.showVisitedCountries && !uiState.showCountriesToVisit) {
        return {
          color: 'rgba(255,255,255,0.18)',
          weight: 1,
          fillOpacity: 0,
        }
      }

      let fillColor = null
      let fillOpacity = 0

      if (isVisited && uiState.showVisitedCountries) {
        fillColor = '#1f5a3a' // vert foncé
        fillOpacity = 0.45
      }

      if (isToVisit && uiState.showCountriesToVisit) {
        fillColor = '#5a1f1f' // rouge foncé
        fillOpacity = 0.45
      }

      return {
        color: 'rgba(255,255,255,0.18)',
        weight: 1,
        fillColor,
        fillOpacity,
      }
    }

    function refreshCountriesStyle() {
      if (!countriesLayer) return
      countriesLayer.setStyle(countryStyle)
    }

    // =============================
    // TOOL MANAGER (1 seul outil actif)
    // =============================
    if (!window.ToolManager || typeof window.ToolManager.onChange !== 'function') {
      console.warn('ToolManager introuvable. Les outils peuvent rester activés simultanément.')
    } else {
      window.ToolManager.onChange((activeTool) => {
        uiState.countryPickMode = activeTool === TOOL_VISITED
        uiState.countryToVisitPickMode = activeTool === TOOL_TOVISIT

        toolCountries.classList.toggle('active', uiState.countryPickMode)
        toolCountriesFutur.classList.toggle('active', uiState.countryToVisitPickMode)

        map.getContainer().style.cursor =
          (uiState.countryPickMode || uiState.countryToVisitPickMode) ? 'pointer' : ''

        refreshCountriesStyle()
      })
    }

    // =============================
    // FILTERS (affichage)
    // =============================
    filterCountries.addEventListener('change', () => {
      uiState.showVisitedCountries = filterCountries.checked

      // si on coupe l'affichage, on coupe aussi l'outil si c'était lui
      if (!uiState.showVisitedCountries && window.ToolManager?.getActiveTool?.() === TOOL_VISITED) {
        window.ToolManager.setActiveTool(null)
      }

      refreshCountriesStyle()
    })

    filterCountriesToVisit.addEventListener('change', () => {
      uiState.showCountriesToVisit = filterCountriesToVisit.checked

      // si on coupe l'affichage, on coupe aussi l'outil si c'était lui
      if (!uiState.showCountriesToVisit && window.ToolManager?.getActiveTool?.() === TOOL_TOVISIT) {
        window.ToolManager.setActiveTool(null)
      }

      refreshCountriesStyle()
    })

    // =============================
    // TOOLS (sélection)
    // =============================
    toolCountries.addEventListener('click', () => {
      // ToolManager gère l'exclusivité
      window.ToolManager?.toggleTool?.(TOOL_VISITED)

      // activer automatiquement l'affichage associé
      uiState.showVisitedCountries = true
      filterCountries.checked = true
      refreshCountriesStyle()
    })

    toolCountriesFutur.addEventListener('click', () => {
      window.ToolManager?.toggleTool?.(TOOL_TOVISIT)

      uiState.showCountriesToVisit = true
      filterCountriesToVisit.checked = true
      refreshCountriesStyle()
    })

    // =============================
    // GEOJSON LAYER
    // =============================
    async function loadCountriesGeoJson() {
      const res = await fetch('../countries.geo.json')
      if (!res.ok) throw new Error('Impossible de charger countries.geojson')
      const geojson = await res.json()

      countriesLayer = L.geoJSON(geojson, {
        style: countryStyle,
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', () => {
            layer.setStyle({ weight: 2, color: 'rgba(255,255,255,0.35)' })
          })

          layer.on('mouseout', () => {
            refreshCountriesStyle()
          })

          layer.on('click', (e) => {
            const iso3 = String(getiso3(feature) || '').toUpperCase()
            if (!iso3 || iso3.length < 2) return

            // MODE VISITED
            if (uiState.countryPickMode) {
              if (visitedCountries.has(iso3)) {
                visitedCountries.delete(iso3)
              } else {
                visitedCountries.add(iso3)
                toVisitCountries.delete(iso3) // ne peut pas être les deux
              }

              refreshCountriesStyle()
              return
            }

            // MODE TO VISIT
            if (uiState.countryToVisitPickMode) {
              // ne peut pas être ajouté si déjà visité
              if (visitedCountries.has(iso3)) return

              if (toVisitCountries.has(iso3)) {
                toVisitCountries.delete(iso3)
              } else {
                toVisitCountries.add(iso3)
              }

              refreshCountriesStyle()
            }
            // toujours notifier quel pays a été cliqué (utile pour places)
            map.fire('country:click', {
              iso3,
              latlng: e.latlng,
              name: feature?.properties?.name || null,
            })
          })
        },
      }).addTo(map)

      refreshCountriesStyle()
    }

    loadCountriesGeoJson().catch(console.error)
  }

  window.initVisitedCountriesMode = initVisitedCountriesMode
})()