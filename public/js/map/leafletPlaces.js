// public/js/map/leafletPlaces.js
// Gestion des "places" (markers) + 2 vues (compact drapeau / détaillée icône)
// + création / modification / suppression persistées via l'API.
// Intégration ToolManager.

(function () {
  function initPlaces(map) {
    // =============================
    // STATE
    // =============================
    const placesById = new Map()      // id -> { data, markerCompact, markerDetailed, pending }
    const countriesById = new Map()   // id Prisma -> country
    const countriesByIso2 = new Map() // "FR" -> country

    // Un LayerGroup par vue : chaque marker est dans son groupe,
    // et on n'affiche qu'un des deux groupes sur la carte.
    const layerCompact = L.layerGroup().addTo(map)
    const layerDetailed = L.layerGroup()

    let detailedView = false

    // Filtres (clés = types "front")
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

    const filterVisited = document.getElementById("filterVisited")
    const filterToVisit = document.getElementById("filterToVisit")
    const filterVille = document.getElementById("filterVille")
    const filterRandonnee = document.getElementById("filterRadonnee") // (typo HTML: Radonnee)
    const filterActivite = document.getElementById("filterActivite")
    const filterPointView = document.getElementById("filterPointView")

    // outil ToolManager -> bouton + type front + libellé par défaut
    const TOOLS = {
      addVisited:   { btn: document.getElementById("toolAddVisited"),   type: "VISITED",   label: "Visité" },
      addToVisit:   { btn: document.getElementById("toolAddToVisit"),   type: "TO_VISIT",  label: "À visiter" },
      addCity:      { btn: document.getElementById("toolAddCity"),      type: "CITY",      label: "Ville" },
      addHike:      { btn: document.getElementById("toolAddHike"),      type: "HIKE",      label: "Randonnée" },
      addActivity:  { btn: document.getElementById("toolAddActivity"),  type: "ACTIVITY",  label: "Activité" },
      addViewpoint: { btn: document.getElementById("toolAddViewpoint"), type: "VIEWPOINT", label: "Point de vue" },
      deletePlace:  { btn: document.getElementById("toolDeletePlace") },
    }

    // =============================
    // MAPPING front <-> base
    // =============================
    // Le front a 6 types (VISITED, TO_VISIT, CITY...), la base a
    // PlaceType (DEFAULT, CITY, HIKE, ACTIVITY, VIEWPOINT) + un booléen visited.
    // VISITED  <-> type DEFAULT + visited true
    // TO_VISIT <-> type DEFAULT + visited false
    function toApiTypeFields(frontType) {
      if (frontType === "VISITED") return { type: "DEFAULT", visited: true }
      if (frontType === "TO_VISIT") return { type: "DEFAULT", visited: false }
      return { type: frontType }
    }

    function toFrontType(place) {
      if (place.type === "DEFAULT") return place.visited ? "VISITED" : "TO_VISIT"
      return place.type
    }

    // Place renvoyée par l'API -> données utilisées par le front
    function toFrontData(place) {
      const country = countriesById.get(place.countryId) || place.country
      return {
        ...place,
        apiType: place.type,          // type tel qu'en base
        type: toFrontType(place),     // type utilisé par les filtres / icônes
        label: place.name,
        countryIso2: (country?.iso2 || "").toLowerCase(),
      }
    }

    function findCountryByIso3(iso3) {
      if (!iso3) return null
      const iso2 = window.IsoCodes?.iso3ToIso2?.(iso3)
      if (!iso2) return null
      return countriesByIso2.get(iso2.toUpperCase()) || null
    }

    // =============================
    // ICON FACTORY
    // =============================
    function makeFlagIcon(iso2) {
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
      switch (type) {
        case "VISITED":   return "bi-geo-alt-fill"
        case "TO_VISIT":  return "bi-bookmark-heart-fill"
        case "CITY":      return "bi-buildings"
        case "HIKE":      return "bi-backpack"
        case "ACTIVITY":  return "bi-bicycle"
        case "VIEWPOINT": return "bi-camera"
        default:          return "bi-geo-alt"
      }
    }

    function makeDetailedIcon(type) {
      return L.divIcon({
        className: "place-icon place-detailed",
        html: `<div class="place-bubble"><i class="bi ${iconClassForType(type)}"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
    }

    // pas de drapeau (pays inconnu) -> on retombe sur l'icône du type
    function makeCompactIcon(data) {
      return makeFlagIcon(data.countryIso2) || makeDetailedIcon(data.type)
    }

    // =============================
    // MARKERS (affichage uniquement, pas d'API ici)
    // =============================
    function showEntry(entry) {
      layerCompact.addLayer(entry.markerCompact)
      layerDetailed.addLayer(entry.markerDetailed)
    }

    function hideEntry(entry) {
      layerCompact.removeLayer(entry.markerCompact)
      layerDetailed.removeLayer(entry.markerDetailed)
    }

    function applyFilters() {
      for (const entry of placesById.values()) {
        if (isTypeVisible(entry.data.type)) showEntry(entry)
        else hideEntry(entry)
      }
    }

    function addMarker(data) {
      const id = data.id

      const markerCompact = L.marker([data.lat, data.lng], {
        icon: makeCompactIcon(data),
        keyboard: false,
      })
      const markerDetailed = L.marker([data.lat, data.lng], {
        icon: makeDetailedIcon(data.type),
        keyboard: false,
      })

      markerCompact.__placeId = id
      markerDetailed.__placeId = id

      function onMarkerClick(e) {
        if (e) L.DomEvent.stopPropagation(e)

        const activeTool = window.ToolManager?.getActiveTool?.()

        map.fire("place:click", { placeId: id })

        if (activeTool === "addRoadtrip") return

        if (activeTool === "deletePlace") {
          deletePlace(id)
          return
        }

        map.fire("ui:openInfoPanel", {
          panelType: "place",
          payload: placesById.get(id)?.data,
        })
      }

      markerCompact.on("click", onMarkerClick)
      markerDetailed.on("click", onMarkerClick)

      const entry = { data, markerCompact, markerDetailed, pending: false }
      placesById.set(id, entry)

      if (isTypeVisible(data.type)) showEntry(entry)
      return entry
    }

    function removeMarker(id) {
      const entry = placesById.get(id)
      if (!entry) return
      hideEntry(entry)
      entry.markerCompact.off()
      entry.markerDetailed.off()
      placesById.delete(id)
    }

    function refreshMarker(entry) {
      const latlng = [entry.data.lat, entry.data.lng]
      entry.markerCompact.setLatLng(latlng).setIcon(makeCompactIcon(entry.data))
      entry.markerDetailed.setLatLng(latlng).setIcon(makeDetailedIcon(entry.data.type))
    }

    // =============================
    // CHARGEMENT
    // =============================
    async function loadCountries() {
      const countries = await window.Api.listCountries()
      countriesById.clear()
      countriesByIso2.clear()
      for (const c of countries) {
        countriesById.set(c.id, c)
        if (c.iso2) countriesByIso2.set(c.iso2.toUpperCase(), c)
      }
    }

    // les pays doivent être chargés avant de créer / afficher des lieux
    const countriesReady = loadCountries().catch((err) => {
      console.error("Erreur chargement pays (places):", err)
    })

    async function loadPlaces() {
      await countriesReady
      const places = await window.Api.listPlaces()

      for (const id of [...placesById.keys()]) removeMarker(id)
      for (const place of places) addMarker(toFrontData(place))
    }

    // =============================
    // CRUD (persisté)
    // =============================
    async function createPlace({ lat, lng, type, label, countryIso3 }) {
      await countriesReady

      const country = findCountryByIso3(countryIso3)
      if (!country) {
        console.warn("Pays introuvable en base pour iso3:", countryIso3)
        return null
      }

      const payload = {
        countryId: country.id,
        name: label || "Lieu",
        lat,
        lng,
        source: "MANUAL",
        ...toApiTypeFields(type),
      }

      try {
        const created = await window.Api.createPlace(payload)
        const entry = addMarker(toFrontData(created))
        map.fire("place:created", { placeId: created.id, data: entry.data })
        return entry
      } catch (err) {
        console.error("Erreur création lieu:", err)
        return null
      }
    }

    // changes = champs en base (name, description, visited, visitedAt, lat, lng...).
    // On peut aussi passer frontType: "VISITED" | "CITY" | ... pour changer le type.
    async function updatePlace(id, changes = {}) {
      const entry = placesById.get(id)
      if (!entry || entry.pending) return null

      const { frontType, ...rest } = changes
      const payload = frontType ? { ...rest, ...toApiTypeFields(frontType) } : rest

      entry.pending = true
      try {
        const updated = await window.Api.updatePlace(id, payload)
        entry.data = toFrontData(updated)
        refreshMarker(entry)
        if (isTypeVisible(entry.data.type)) showEntry(entry)
        else hideEntry(entry)
        map.fire("place:updated", { placeId: id, data: entry.data })
        return entry
      } catch (err) {
        console.error("Erreur modification lieu:", err)
        return null
      } finally {
        entry.pending = false
      }
    }

    async function deletePlace(id) {
      const entry = placesById.get(id)
      if (!entry || entry.pending) return false

      entry.pending = true
      try {
        await window.Api.deletePlace(id)
        removeMarker(id)
        map.fire("place:removed", { placeId: id })
        return true
      } catch (err) {
        entry.pending = false
        console.error("Erreur suppression lieu:", err)
        return false
      }
    }

    // =============================
    // VUE DÉTAILLÉE
    // =============================
    function setDetailedView(enabled) {
      detailedView = !!enabled
      const show = detailedView ? layerDetailed : layerCompact
      const hide = detailedView ? layerCompact : layerDetailed
      if (map.hasLayer(hide)) map.removeLayer(hide)
      if (!map.hasLayer(show)) map.addLayer(show)
    }

    // =============================
    // MAP CLICK -> CREATE
    // =============================
    map.on("country:click", ({ iso3, latlng }) => {
      const tool = window.ToolManager?.getActiveTool?.()
      const config = TOOLS[tool]
      if (!config || !config.type) return

      createPlace({
        lat: latlng.lat,
        lng: latlng.lng,
        type: config.type,
        label: config.label,
        countryIso3: iso3,
      })
    })

    // =============================
    // TOOL BUTTONS -> ToolManager
    // =============================
    for (const [toolName, { btn }] of Object.entries(TOOLS)) {
      btn?.addEventListener("click", () => window.ToolManager?.toggleTool?.(toolName))
    }

    window.ToolManager?.onChange?.((active) => {
      for (const [toolName, { btn }] of Object.entries(TOOLS)) {
        btn?.classList.toggle("active", toolName === active)
      }

      // ne touche au curseur que pour nos outils (les outils pays gèrent le leur)
      if (active === "deletePlace") map.getContainer().style.cursor = "not-allowed"
      else if (TOOLS[active]) map.getContainer().style.cursor = "crosshair"
      else if (!active) map.getContainer().style.cursor = ""
    })

    // =============================
    // FILTRES
    // =============================
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

    // =============================
    // INIT
    // =============================
    loadPlaces().catch((err) => console.error("Erreur chargement lieux:", err))

    const publicApi = {
      placesById,
      createPlace,
      updatePlace,
      deletePlace,
      removePlace: deletePlace, // alias pour le code existant
      reload: loadPlaces,
      setDetailedView,
    }

    window.PlacesApi = publicApi
    return publicApi
  }

  window.initPlaces = initPlaces
})()