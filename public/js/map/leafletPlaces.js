// public/js/map/leafletPlaces.js
// Gestion des "places" (markers) + 2 vues (compact drapeau / détaillée icône)
// + suppression. Intégration ToolManager.

(function () {
    function initPlaces(map) {
      // =============================
      // STATE
      // =============================
      const DEFAULT_ISO2 = "fr" // pour l'instant: pays fixe
      const placesById = new Map() // id -> { data, markerCompact, markerDetailed }
  
      // LayerGroups (on n'affiche qu'un seul des deux)
      const layerCompact = L.layerGroup().addTo(map)
      const layerDetailed = L.layerGroup() // pas ajouté par défaut
  
      // Vue détaillée ?
      let detailedView = false

      // Filtrer states
      const filters = {
        VISITED: true,
        TO_VISIT: true,
        CITY: true,
        HIKE: true,
        ACTIVITY: true,
        VIEWPOINT: true,
      }
      
      function isTypeVisible(type) {
        return filters[type] !== false
      }
  
      // =============================
      // DOM
      // =============================
      const filterDetailed = document.getElementById("filterDetailledView")
  
      // Outils (IDs à mettre dans ton HTML)
      const toolAddVisited = document.getElementById("toolAddVisited")
      const toolAddToVisit = document.getElementById("toolAddToVisit")
      const toolDeletePlace = document.getElementById("toolDeletePlace")
      const toolAddCity = document.getElementById("toolAddCity")
      const toolAddHike = document.getElementById("toolAddHike")
      const toolAddActivity = document.getElementById("toolAddActivity")
      const toolAddViewpoint = document.getElementById("toolAddViewpoint")

      // Filtres (IDs déjà dans ton HTML)
      const filterVisited = document.getElementById("filterVisited")
      const filterToVisit = document.getElementById("filterToVisit")
      const filterVille = document.getElementById("filterVille")
      const filterRandonnee = document.getElementById("filterRadonnee") // (typo HTML: Radonnee)
      const filterActivite = document.getElementById("filterActivite")
      const filterPointView = document.getElementById("filterPointView")
  
      // =============================
      // ICON FACTORY
      // =============================
      function makeFlagIcon(iso3OrIso2) {
        let iso2 = iso3OrIso2
      
        // si c’est un ISO3, on convertit
        if (iso3OrIso2 && iso3OrIso2.length === 3) {
          iso2 = window.IsoCodes?.iso3ToIso2?.(iso3OrIso2)
        }
      
        if (!iso2) return null
      
        const url = `/resources/${iso2.toLowerCase()}.png`
      
        return L.divIcon({
          className: "place-icon place-flag",
          html: `<div class="place-bubble" style="background-image:url('${url}')"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
      }
  
      function iconClassForType(type) {
        // mapping type -> bootstrap icon
        switch (type) {
          case "VISITED":
            return "bi-geo-alt-fill"
          case "TO_VISIT":
            return "bi-bookmark-heart-fill"
          case "CITY":
            return "bi-buildings"
          case "HIKE":
            return "bi-backpack"
          case "ACTIVITY":
            return "bi-bicycle"
          case "VIEWPOINT":
            return "bi-camera"
          default:
            return "bi-geo-alt"
        }
      }
  
      function makeDetailedIcon(type) {
        const iconClass = iconClassForType(type)
        return L.divIcon({
          className: "place-icon place-detailed",
          html: `<div class="place-bubble"><i class="bi ${iconClass}"></i></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
      }
  
      // =============================
      // CRUD (front)
      // =============================
      function newId() {
        try {
          return crypto.randomUUID()
        } catch {
          return "pl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
        }
      }
  
      function addToCorrectLayer(markers) {
        if (detailedView) {
          try { layerCompact.removeLayer(markers.markerCompact) } catch {}
          layerDetailed.addLayer(markers.markerDetailed)
        } else {
          try { layerDetailed.removeLayer(markers.markerDetailed) } catch {}
          layerCompact.addLayer(markers.markerCompact)
        }
      }
  
      function createPlace({ lat, lng, type, label, countryIso2 }) {
        const id = newId()
  
        const data = {
          id,
          lat,
          lng,
          type,
          label: label || "",
          countryIso2: (countryIso2 || DEFAULT_ISO2).toLowerCase(),
        }
  
        const markerCompact = L.marker([lat, lng], {
          icon: makeFlagIcon(data.countryIso2),
          keyboard: false,
        })
  
        const markerDetailed = L.marker([lat, lng], {
          icon: makeDetailedIcon(type),
          keyboard: false,
        })
  
        // Stockage metadata pour suppression etc.
        markerCompact.__placeId = id
        markerDetailed.__placeId = id
  
        // Interaction click marker (suppression si outil delete)
        function onMarkerClick() {
          map.fire("place:click", { placeId: id })
          if (window.ToolManager?.getActiveTool() === "deletePlace") {
            removePlace(id)
          } else {
            map.fire('ui:openInfoPanel', {
              panelType: 'place',
              payload: placesById.get(id)?.data
            })
            console.log("Place clicked:", placesById.get(id)?.data)
          }
        }
  
        markerCompact.on("click", onMarkerClick)
        markerDetailed.on("click", onMarkerClick)
  
        const entry = { data, markerCompact, markerDetailed }
        placesById.set(id, entry)
  
        addToCorrectLayer(entry)
        applyFilters()
  
        return entry
      }
  
      function removePlace(id) {
        const entry = placesById.get(id)
        if (!entry) return false
  
        try { layerCompact.removeLayer(entry.markerCompact) } catch {}
        try { layerDetailed.removeLayer(entry.markerDetailed) } catch {}
  
        try { entry.markerCompact.remove() } catch {}
        try { entry.markerDetailed.remove() } catch {}
  
        placesById.delete(id)
        map.fire("place:removed", { placeId: id })
        return true
      }
  
      function setDetailedView(enabled) {
        detailedView = !!enabled
  
        if (detailedView) {
          if (map.hasLayer(layerCompact)) map.removeLayer(layerCompact)
          if (!map.hasLayer(layerDetailed)) map.addLayer(layerDetailed)
        } else {
          if (map.hasLayer(layerDetailed)) map.removeLayer(layerDetailed)
          if (!map.hasLayer(layerCompact)) map.addLayer(layerCompact)
        }
  
        // Replacer tous les markers dans le bon layer (au cas où)
        for (const entry of placesById.values()) addToCorrectLayer(entry)
        applyFilters()
      }
  
      // =============================
      // MAP CLICK -> CREATE
      // =============================
      map.on('country:click', ({ iso3, latlng }) => {
        const tool = window.ToolManager?.getActiveTool()
        if (!tool) return
      
        if (tool === "addVisited") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "VISITED", label: "Visité", countryIso2: iso3 })
        }
      
        if (tool === "addToVisit") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "TO_VISIT", label: "À visiter", countryIso2: iso3 })
        }
      
        if (tool === "addCity") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "CITY", label: "Ville", countryIso2: iso3 })
        }
      
        if (tool === "addHike") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "HIKE", label: "Randonnée", countryIso2: iso3 })
        }
      
        if (tool === "addActivity") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "ACTIVITY", label: "Activité", countryIso2: iso3 })
        }
      
        if (tool === "addViewpoint") {
          createPlace({ lat: latlng.lat, lng: latlng.lng, type: "VIEWPOINT", label: "Point de vue", countryIso2: iso3 })
        }
      })
  
      // =============================
      // TOOL BUTTONS -> ToolManager
      // =============================
      // Active tool unique => ToolManager gère déjà (activeTool unique)
      if (toolAddVisited) toolAddVisited.addEventListener("click", () => window.ToolManager.toggleTool("addVisited"))
      if (toolAddToVisit) toolAddToVisit.addEventListener("click", () => window.ToolManager.toggleTool("addToVisit"))
      if (toolDeletePlace) toolDeletePlace.addEventListener("click", () => window.ToolManager.toggleTool("deletePlace"))
      if (toolAddCity) toolAddCity.addEventListener("click", () => window.ToolManager.toggleTool("addCity"))
      if (toolAddHike) toolAddHike.addEventListener("click", () => window.ToolManager.toggleTool("addHike"))
      if (toolAddActivity) toolAddActivity.addEventListener("click", () => window.ToolManager.toggleTool("addActivity"))
      if (toolAddViewpoint) toolAddViewpoint.addEventListener("click", () => window.ToolManager.toggleTool("addViewpoint"))
  
      // Switch "vue détaillée"
      if (filterDetailed) {
        filterDetailed.addEventListener("change", () => setDetailedView(filterDetailed.checked))
        setDetailedView(filterDetailed.checked)
      }

      function bindFilter(checkbox, typeKey) {
        if (!checkbox) return
        filters[typeKey] = checkbox.checked
        checkbox.addEventListener("change", () => {
          filters[typeKey] = checkbox.checked
          applyFilters()
        })
      }
      
      bindFilter(filterVisited, "VISITED")
      bindFilter(filterToVisit, "TO_VISIT")
      bindFilter(filterVille, "CITY")
      bindFilter(filterRandonnee, "HIKE")
      bindFilter(filterActivite, "ACTIVITY")
      bindFilter(filterPointView, "VIEWPOINT")
  
      // feedback UI : boutons actifs (classe .active)
      window.ToolManager?.onChange((active) => {
        ;[
          toolAddVisited, toolAddToVisit, toolDeletePlace,
          toolAddCity, toolAddHike, toolAddActivity, toolAddViewpoint
        ].forEach((btn) => btn?.classList.remove("active"))
  
        if (active === "addVisited") toolAddVisited?.classList.add("active")
        if (active === "addToVisit") toolAddToVisit?.classList.add("active")
        if (active === "deletePlace") toolDeletePlace?.classList.add("active")
        if (active === "addCity") toolAddCity?.classList.add("active")
        if (active === "addHike") toolAddHike?.classList.add("active")
        if (active === "addActivity") toolAddActivity?.classList.add("active")
        if (active === "addViewpoint") toolAddViewpoint?.classList.add("active")
  
        // curseur
        map.getContainer().style.cursor = active ? "crosshair" : ""
        if (active === "deletePlace") map.getContainer().style.cursor = "not-allowed"
      })

      // FILTERS

      function applyFilters() {
        for (const entry of placesById.values()) {
          const visible = isTypeVisible(entry.data.type)
      
          // On enlève des 2 layers pour éviter les doublons
          try { layerCompact.removeLayer(entry.markerCompact) } catch {}
          try { layerDetailed.removeLayer(entry.markerDetailed) } catch {}
      
          if (!visible) continue
      
          // Remet dans le bon layer selon detailedView
          addToCorrectLayer(entry)
        }
      }
      window.PlacesApi = { placesById, createPlace, removePlace, setDetailedView }
  
      // expose pour debug
      return {
        placesById,
        createPlace,
        removePlace,
        setDetailedView,
      }
    }
    window.initPlaces = initPlaces
  })()