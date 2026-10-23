// public/js/map/leafletCountries.js
(function () {
  function initVisitedCountriesMode(map) {
    // =============================
    // FRONT STATE
    // =============================
    const visitedCountries = new Set() // ex: "FRA", "CAN", ...
    const toVisitCountries = new Set()
    const countriesByIso3 = new Map()  // iso3 -> country (base)
    const featuresByIso3 = new Map()   // iso3 -> feature GeoJSON (pour le nom de secours)

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
    // STATUT D'UN PAYS
    // =============================
    // 3 statuts possibles : 'visited' | 'toVisit' | 'none'
    function getCountryStatus(iso3) {
      if (visitedCountries.has(iso3)) return 'visited'
      if (toVisitCountries.has(iso3)) return 'toVisit'
      return 'none'
    }

    // Données envoyées au panneau d'info
    function buildCountryPanelPayload(iso3) {
      const country = countriesByIso3.get(iso3) || null
      const feature = featuresByIso3.get(iso3)

      // lieux du pays, déjà chargés par leafletPlaces.js
      const places = country && window.PlacesApi
        ? [...window.PlacesApi.placesById.values()]
            .map((entry) => entry.data)
            .filter((place) => place.countryId === country.id)
        : []

      const placesByType = {}
      for (const place of places) {
        placesByType[place.type] = (placesByType[place.type] || 0) + 1
      }

      return {
        id: country?.id ?? null,
        iso3,
        iso2: country?.iso2 ?? null,
        name: country?.name || feature?.properties?.name || 'Pays',
        status: getCountryStatus(iso3),
        visited: visitedCountries.has(iso3),
        toVisit: toVisitCountries.has(iso3),
        coverImagePath: country?.uiCoverImagePath ?? null,
        places,
        stats: {
          placesCount: places.length,
          visitedPlacesCount: places.filter((p) => p.visited).length,
          placesByType, // ex: { CITY: 3, HIKE: 1, VISITED: 2 }
        },
      }
    }

    // Change le statut d'un pays : API d'abord, puis état front + carte + panneau.
    // Lève une erreur si le pays est inconnu ou si l'API échoue.
    async function setCountryStatus(iso3, status) {
      iso3 = String(iso3 || '').toUpperCase()

      if (!['visited', 'toVisit', 'none'].includes(status)) {
        throw new Error(`Statut invalide: ${status}`)
      }

      const country = countriesByIso3.get(iso3)
      if (!country) throw new Error(`Pays introuvable en base pour iso3: ${iso3}`)

      const data = {
        visited: status === 'visited',
        toVisit: status === 'toVisit',
      }

      await window.Api.updateCountry(country.id, data)

      country.visited = data.visited
      country.toVisit = data.toVisit

      if (data.visited) visitedCountries.add(iso3)
      else visitedCountries.delete(iso3)

      if (data.toVisit) toVisitCountries.add(iso3)
      else toVisitCountries.delete(iso3)

      refreshCountriesStyle()
      map.fire('country:updated', { iso3, payload: buildCountryPanelPayload(iso3) })

      return country
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

        toolCountries?.classList.toggle('active', uiState.countryPickMode)
        toolCountriesFutur?.classList.toggle('active', uiState.countryToVisitPickMode)

        if (uiState.countryPickMode || uiState.countryToVisitPickMode) {
          map.getContainer().style.cursor = 'pointer'
        } else if (!activeTool) {
          map.getContainer().style.cursor = ''
        }

        refreshCountriesStyle()
      })
    }

    // =============================
    // FILTERS (affichage)
    // =============================
    filterCountries?.addEventListener('change', () => {
      uiState.showVisitedCountries = filterCountries.checked

      if (!uiState.showVisitedCountries && window.ToolManager?.getActiveTool?.() === TOOL_VISITED) {
        window.ToolManager.setActiveTool(null)
      }

      refreshCountriesStyle()
    })

    filterCountriesToVisit?.addEventListener('change', () => {
      uiState.showCountriesToVisit = filterCountriesToVisit.checked

      if (!uiState.showCountriesToVisit && window.ToolManager?.getActiveTool?.() === TOOL_TOVISIT) {
        window.ToolManager.setActiveTool(null)
      }

      refreshCountriesStyle()
    })

    // =============================
    // TOOLS (sélection)
    // =============================
    toolCountries?.addEventListener('click', () => {
      window.ToolManager?.toggleTool?.(TOOL_VISITED)

      uiState.showVisitedCountries = true
      if (filterCountries) filterCountries.checked = true
      refreshCountriesStyle()
    })

    toolCountriesFutur?.addEventListener('click', () => {
      window.ToolManager?.toggleTool?.(TOOL_TOVISIT)

      uiState.showCountriesToVisit = true
      if (filterCountriesToVisit) filterCountriesToVisit.checked = true
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
          const featureIso3 = String(getiso3(feature) || '').toUpperCase()
          if (featureIso3) featuresByIso3.set(featureIso3, feature)

          layer.on('mouseover', () => {
            layer.setStyle({ weight: 2, color: 'rgba(255,255,255,0.35)' })
          })

          layer.on('mouseout', () => {
            refreshCountriesStyle()
          })

          layer.on('click', async (e) => {
            const iso3 = featureIso3
            if (!iso3 || iso3.length < 2) return

            // MODE VISITED : bascule visité <-> pas visité
            if (uiState.countryPickMode) {
              const next = visitedCountries.has(iso3) ? 'none' : 'visited'
              try {
                await setCountryStatus(iso3, next)
              } catch (err) {
                console.error('Erreur update country visited:', err)
              }
              return
            }

            // MODE TO VISIT : bascule à visiter <-> pas visité
            if (uiState.countryToVisitPickMode) {
              // un pays visité ne peut pas être "à visiter" via cet outil
              if (visitedCountries.has(iso3)) return

              const next = toVisitCountries.has(iso3) ? 'none' : 'toVisit'
              try {
                await setCountryStatus(iso3, next)
              } catch (err) {
                console.error('Erreur update country toVisit:', err)
              }
              return
            }

            // utile pour leafletPlaces / autres modules
            map.fire('country:click', {
              iso3,
              latlng: e.latlng
            })

            const activeTool = window.ToolManager?.getActiveTool?.()

            const blockInfoPanelTools = [
              'addVisited',
              'addToVisit',
              'addCity',
              'addHike',
              'addActivity',
              'addViewpoint',
              'addRoadtrip',
              'deletePlace',
            ]

            if (blockInfoPanelTools.includes(activeTool)) return

            // ouvre la sidebar d'info
            map.fire('ui:openInfoPanel', {
              panelType: 'country',
              payload: buildCountryPanelPayload(iso3)
            })
          })
        },
      }).addTo(map)

      refreshCountriesStyle()
    }

    async function loadCountriesFromApi() {
      const countries = await window.Api.listCountries()

      countriesByIso3.clear()
      visitedCountries.clear()
      toVisitCountries.clear()

      for (const country of countries) {
        const iso3 = window.IsoCodes?.iso2ToIso3?.(country.iso2)
        if (!iso3) continue

        const iso3Upper = iso3.toUpperCase()
        countriesByIso3.set(iso3Upper, country)

        if (country.visited) visitedCountries.add(iso3Upper)
        if (country.toVisit) toVisitCountries.add(iso3Upper)
      }

      refreshCountriesStyle()
    }

    loadCountriesGeoJson()
      .then(() => loadCountriesFromApi())
      .catch(console.error)

    // =============================
    // API PUBLIQUE (utilisée par index.js / panneau d'info)
    // =============================
    window.CountriesApi = {
      getCountryStatus,
      setCountryStatus,
      buildCountryPanelPayload,
      reload: loadCountriesFromApi,
    }
  }

  window.initVisitedCountriesMode = initVisitedCountriesMode
})()