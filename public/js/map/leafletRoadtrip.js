// public/js/map/leafletRoadtrips.js
// Roadtrips = suite d'étapes (TripStop) persistées via l'API.
// Une étape pointe vers un lieu (placeId) ou est un point libre (lat/lng).
//
// Création : outil "addRoadtrip"
//   - clic sur un lieu existant -> il devient l'étape suivante
//   - clic sur un pays          -> un lieu "Étape" est créé à cet endroit
//   - double-clic (ou bouton du panneau) -> enregistre le roadtrip
//   - Échap (ou bouton du panneau)       -> annule
// Suppression : outil "deletePlace" + clic sur la ligne (ou bouton du panneau)
// Si un lieu étape est supprimé, le roadtrip est conservé : l'étape garde
// son nom et ses coordonnées (copiés côté serveur).
//
// Expose : window.RoadtripsApi

(function () {
  function initRoadtrips(map) {
    // =============================
    // DOM / CONFIG
    // =============================
    const toolAddRoadTrip = document.getElementById("toolAddRoadTrip")
    const filterRoadtrips = document.getElementById("filterRoadtrips")

    const TOOL_ROADTRIP = "addRoadtrip"
    const TOOL_DELETE = "deletePlace"

    // délai pour distinguer un clic d'un double-clic (sinon le double-clic
    // de fin ajouterait 2 étapes)
    const CLICK_DELAY_MS = 300

    const LINE_STYLE = { weight: 3, color: "rgba(120, 200, 160, 0.9)", opacity: 0.9 }
    const BUILDING_STYLE = { ...LINE_STYLE, dashArray: "6 6" }

    // =============================
    // STATE
    // =============================
    const roadtripsById = new Map() // id -> { data (trip API), polyline, pending }
    const layerRoadtripLines = L.layerGroup().addTo(map)

    // session de création : { steps: [{ placeId, title, lat, lng }], polyline, queue }
    let building = null
    let saving = false
    let pendingClickTimers = []

    // =============================
    // POSITIONS
    // =============================
    // Position d'une étape : celle du lieu s'il existe encore (suit ses
    // déplacements), sinon les coordonnées de l'étape.
    function stopLatLng(stop) {
      const entry = stop.placeId ? window.PlacesApi?.placesById?.get(stop.placeId) : null
      if (entry) return L.latLng(entry.data.lat, entry.data.lng)
      if (stop.lat != null && stop.lng != null) return L.latLng(stop.lat, stop.lng)
      return null
    }

    function stopTitle(stop) {
      const entry = stop.placeId ? window.PlacesApi?.placesById?.get(stop.placeId) : null
      return entry?.data.label || stop.title || stop.place?.name || "Étape"
    }

    function latLngsOf(stops) {
      return stops.map(stopLatLng).filter(Boolean)
    }

    // =============================
    // DONNÉES POUR LE PANNEAU
    // =============================
    function stepsPayload(stops) {
      return stops.map((stop) => {
        const ll = stopLatLng(stop)
        return {
          id: stop.id ?? null,
          placeId: stop.placeId ?? null,
          title: stopTitle(stop),
          linked: !!(stop.placeId && window.PlacesApi?.placesById?.has(stop.placeId)),
          lat: ll?.lat ?? null,
          lng: ll?.lng ?? null,
        }
      })
    }

    function buildPanelPayload(id) {
      const entry = roadtripsById.get(id)
      if (!entry) return null
      const trip = entry.data
      return {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        startDate: trip.startDate,
        endDate: trip.endDate,
        stepCount: trip.stops.length,
        steps: stepsPayload(trip.stops),
        isBuilding: false,
      }
    }

    function getBuildingPayload() {
      if (!building) return null
      return {
        id: null,
        isBuilding: true,
        stepCount: building.steps.length,
        steps: stepsPayload(building.steps),
      }
    }

    function openPanel(payload) {
      if (payload) map.fire("ui:openInfoPanel", { panelType: "roadtrip", payload })
    }

    // =============================
    // AFFICHAGE
    // =============================
    function setLinesVisible(visible) {
      if (visible) {
        if (!map.hasLayer(layerRoadtripLines)) map.addLayer(layerRoadtripLines)
      } else if (map.hasLayer(layerRoadtripLines)) {
        map.removeLayer(layerRoadtripLines)
      }
    }

    function addTripLayer(trip) {
      const polyline = L.polyline(latLngsOf(trip.stops), LINE_STYLE)

      polyline.on("click", (e) => {
        L.DomEvent.stopPropagation(e)
        const tool = window.ToolManager?.getActiveTool?.()
        if (tool === TOOL_ROADTRIP) return
        if (tool === TOOL_DELETE) {
          deleteTrip(trip.id)
          return
        }
        openPanel(buildPanelPayload(trip.id))
      })

      layerRoadtripLines.addLayer(polyline)
      const entry = { data: trip, polyline, pending: false }
      roadtripsById.set(trip.id, entry)
      return entry
    }

    function removeTripLayer(id) {
      const entry = roadtripsById.get(id)
      if (!entry) return
      layerRoadtripLines.removeLayer(entry.polyline)
      entry.polyline.off()
      roadtripsById.delete(id)
    }

    function redrawTrip(entry) {
      entry.polyline.setLatLngs(latLngsOf(entry.data.stops))
    }

    // =============================
    // CHARGEMENT
    // =============================
    async function loadTrips() {
      await window.PlacesApi?.ready // les lignes s'appuient sur les positions des lieux
      const trips = await window.Api.listTrips()

      for (const id of [...roadtripsById.keys()]) removeTripLayer(id)
      for (const trip of trips) addTripLayer(trip)
    }

    const tripsReady = loadTrips().catch((err) => {
      console.error("Erreur chargement roadtrips:", err)
    })

    // =============================
    // SESSION DE CRÉATION
    // =============================
    function startBuilding() {
      if (building) return building
      building = { steps: [], polyline: null, queue: Promise.resolve() }
      return building
    }

    function notifyBuilding() {
      map.fire("roadtrip:building", { payload: getBuildingPayload() })
    }

    function redrawBuilding() {
      if (!building) return

      if (!building.polyline) {
        building.polyline = L.polyline([], BUILDING_STYLE)
        building.polyline.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          if (window.ToolManager?.getActiveTool?.() === TOOL_DELETE) {
            cancelBuilding()
            return
          }
          openPanel(getBuildingPayload())
        })
        layerRoadtripLines.addLayer(building.polyline)
      }

      building.polyline.setLatLngs(latLngsOf(building.steps))
      notifyBuilding()
    }

    function clearPendingClicks() {
      pendingClickTimers.forEach(clearTimeout)
      pendingClickTimers = []
    }

    function cancelBuilding() {
      clearPendingClicks()
      if (!building) return
      if (building.polyline) {
        layerRoadtripLines.removeLayer(building.polyline)
        building.polyline.off()
      }
      building = null
      notifyBuilding() // payload null
    }

    // Les étapes passent par une file : elles restent dans l'ordre des clics,
    // même quand l'une d'elles attend la création d'un lieu.
    function enqueueStep(task) {
      const session = startBuilding()
      session.queue = session.queue
        .then(() => task(session))
        .catch((err) => console.error("Erreur ajout étape:", err))
    }

    function pushStep(session, step) {
      if (building !== session) return // session annulée entre-temps
      const last = session.steps[session.steps.length - 1]
      if (step.placeId && last?.placeId === step.placeId) return // doublon consécutif
      session.steps.push(step)
      redrawBuilding()
    }

    function addStepFromPlace(placeId) {
      enqueueStep(async (session) => {
        const entry = window.PlacesApi?.placesById?.get(placeId)
        if (!entry) return
        pushStep(session, {
          placeId,
          title: entry.data.label,
          lat: entry.data.lat,
          lng: entry.data.lng,
        })
      })
    }

    function addStepAt(latlng, iso3) {
      enqueueStep(async (session) => {
        const entry = await window.PlacesApi?.createPlace?.({
          lat: latlng.lat,
          lng: latlng.lng,
          type: "VISITED",
          label: "Étape",
          countryIso3: iso3,
        })

        // pays inconnu en base -> point libre (pas de lieu créé)
        pushStep(session, entry
          ? { placeId: entry.data.id, title: entry.data.label, lat: entry.data.lat, lng: entry.data.lng }
          : { placeId: null, title: "Étape", lat: latlng.lat, lng: latlng.lng })
      })
    }

    function nextDefaultName() {
      return `Roadtrip ${roadtripsById.size + 1}`
    }

    // Enregistre la session en cours. Renvoie le trip créé, ou null.
    async function finishBuilding() {
      clearPendingClicks()
      if (!building || saving) return null

      const session = building
      await session.queue
      if (building !== session) return null

      // il faut au moins 2 étapes pour une trajectoire
      if (session.steps.length < 2) {
        cancelBuilding()
        return null
      }

      saving = true
      try {
        const created = await window.Api.createTrip({
          name: nextDefaultName(),
          stops: session.steps.map(({ placeId, title, lat, lng }) => ({ placeId, title, lat, lng })),
        })

        if (building === session) cancelBuilding()
        addTripLayer(created)
        map.fire("roadtrip:created", { id: created.id, payload: buildPanelPayload(created.id) })
        return created
      } catch (err) {
        // on garde le brouillon : l'utilisateur peut réessayer
        console.error("Erreur enregistrement roadtrip:", err)
        return null
      } finally {
        saving = false
      }
    }

    // =============================
    // CRUD (persisté)
    // =============================
    // changes : { name, description, startDate, endDate } (null = effacer)
    async function updateTrip(id, changes = {}) {
      const entry = roadtripsById.get(id)
      if (!entry || entry.pending) return null

      entry.pending = true
      try {
        const updated = await window.Api.updateTrip(id, changes)
        entry.data = updated
        redrawTrip(entry)
        map.fire("roadtrip:updated", { id, payload: buildPanelPayload(id) })
        return entry
      } catch (err) {
        console.error("Erreur modification roadtrip:", err)
        return null
      } finally {
        entry.pending = false
      }
    }

    async function deleteTrip(id) {
      const entry = roadtripsById.get(id)
      if (!entry || entry.pending) return false

      entry.pending = true
      try {
        await window.Api.deleteTrip(id)
        removeTripLayer(id)
        map.fire("roadtrip:removed", { id })
        return true
      } catch (err) {
        entry.pending = false
        console.error("Erreur suppression roadtrip:", err)
        return false
      }
    }

    // =============================
    // TOOL MANAGER / UI
    // =============================
    toolAddRoadTrip?.addEventListener("click", () => {
      window.ToolManager?.toggleTool?.(TOOL_ROADTRIP)

      // activer automatiquement l'affichage des roadtrips
      if (filterRoadtrips) {
        filterRoadtrips.checked = true
        setLinesVisible(true)
      }
    })

    window.ToolManager?.onChange?.((active) => {
      const isActive = active === TOOL_ROADTRIP
      toolAddRoadTrip?.classList.toggle("active", isActive)

      // ne touche au curseur que pour notre outil
      if (isActive) map.getContainer().style.cursor = "crosshair"
      else if (!active) map.getContainer().style.cursor = ""

      // quitter l'outil annule le brouillon (sauf enregistrement en cours)
      if (!isActive && building && !saving) cancelBuilding()

      // dblclick zoom coupé pendant le roadtrip
      if (map.doubleClickZoom) {
        if (isActive) map.doubleClickZoom.disable()
        else map.doubleClickZoom.enable()
      }
    })

    if (filterRoadtrips) {
      filterRoadtrips.addEventListener("change", () => {
        setLinesVisible(filterRoadtrips.checked)

        if (!filterRoadtrips.checked && window.ToolManager?.getActiveTool?.() === TOOL_ROADTRIP) {
          window.ToolManager.setActiveTool(null)
        }
      })
      setLinesVisible(filterRoadtrips.checked)
    } else {
      setLinesVisible(true)
    }

    // Échap : annule le brouillon
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !building) return
      if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
      cancelBuilding()
    })

    // =============================
    // EVENTS BRIDGE (leafletPlaces + leafletCountries)
    // =============================

    // 1) clic sur un pays : nouvelle étape (après le délai anti double-clic)
    map.on("country:click", ({ iso3, latlng }) => {
      if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return

      const timer = setTimeout(() => {
        pendingClickTimers = pendingClickTimers.filter((t) => t !== timer)
        addStepAt(latlng, iso3)
      }, CLICK_DELAY_MS)
      pendingClickTimers.push(timer)
    })

    // 2) clic sur un lieu existant : il devient l'étape suivante
    map.on("place:click", ({ placeId }) => {
      if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
      if (placeId) addStepFromPlace(placeId)
    })

    // 3) double-clic : enregistre le roadtrip (l'outil reste actif)
    map.on("dblclick", (e) => {
      if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
      e?.originalEvent?.preventDefault?.()
      finishBuilding()
    })

    // 4) lieu supprimé : les roadtrips sont conservés, l'étape devient un point libre
    map.on("place:removed", ({ placeId }) => {
      if (!placeId) return

      for (const entry of roadtripsById.values()) {
        let touched = false
        for (const stop of entry.data.stops) {
          if (stop.placeId !== placeId) continue
          stop.title = stop.title || stop.place?.name || "Étape"
          stop.lat = stop.lat ?? stop.place?.lat ?? null
          stop.lng = stop.lng ?? stop.place?.lng ?? null
          stop.placeId = null
          stop.place = null
          touched = true
        }
        if (touched) {
          redrawTrip(entry)
          map.fire("roadtrip:updated", { id: entry.data.id, payload: buildPanelPayload(entry.data.id) })
        }
      }

      // brouillon : l'étape n'existe plus, on la retire
      if (building) {
        const before = building.steps.length
        building.steps = building.steps.filter((s) => s.placeId !== placeId)
        if (building.steps.length !== before) redrawBuilding()
      }
    })

    // 5) lieu modifié (nom, position...) : on redessine les roadtrips concernés
    map.on("place:updated", ({ placeId }) => {
      for (const entry of roadtripsById.values()) {
        if (!entry.data.stops.some((s) => s.placeId === placeId)) continue
        redrawTrip(entry)
        map.fire("roadtrip:updated", { id: entry.data.id, payload: buildPanelPayload(entry.data.id) })
      }
      if (building?.steps.some((s) => s.placeId === placeId)) redrawBuilding()
    })

    // =============================
    // API PUBLIQUE
    // =============================
    const publicApi = {
      roadtripsById,
      ready: tripsReady,
      reload: loadTrips,
      finishBuilding,
      cancelBuilding,
      updateTrip,
      deleteTrip,
      buildPanelPayload,
      getBuildingPayload,
    }

    window.RoadtripsApi = publicApi
    return publicApi
  }

  window.initRoadtrips = initRoadtrips
})()