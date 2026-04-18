// public/js/map/leafletRoadtrips.js
// Roadtrips = suite d'étapes qui sont des "places" existantes (ou créées)
// On ne stocke ici QUE la trajectoire (polyline + placeIds étapes)
// Si une place étape est supprimée => le roadtrip est supprimé
// Le bouton deletePlace permet aussi de supprimer un roadtrip (clic sur la ligne)

(function () {
    function initRoadtrips(map) {
      // =============================
      // DOM
      // =============================
      const toolAddRoadTrip = document.getElementById("toolAddRoadTrip")
      const filterRoadtrips = document.getElementById("filterRoadtrips")
  
      // ToolManager
      const TOOL_ROADTRIP = "addRoadtrip"
      const TOOL_DELETE = "deletePlace" // ton outil poubelle existant
  
      // =============================
      // STATE
      // =============================
      const roadtripsById = new Map() // id -> { id, stepPlaceIds:[], polyline }
      let showRoadtrips = filterRoadtrips ? !!filterRoadtrips.checked : true
  
      // session de création en cours
      let building = false
      let buildingId = null
      let buildingStepIds = []
      let buildingPolyline = null
  
      const layerRoadtripLines = L.layerGroup().addTo(map)
  
      // =============================
      // UTILS
      // =============================
      function newId() {
        try {
          return crypto.randomUUID()
        } catch {
          return "rt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
        }
      }
  
      function setLinesVisible(visible) {
        showRoadtrips = !!visible
        if (showRoadtrips) {
          if (!map.hasLayer(layerRoadtripLines)) map.addLayer(layerRoadtripLines)
        } else {
          if (map.hasLayer(layerRoadtripLines)) map.removeLayer(layerRoadtripLines)
        }
      }
  
      function ensureBuildingPolyline() {
        if (buildingPolyline) return
        buildingPolyline = L.polyline([], {
          weight: 3,
          color: "rgba(120, 200, 160, 0.9)",
          opacity: 0.9,
        })
  
        // suppression du roadtrip via outil delete
        buildingPolyline.on("click", () => {
          if (window.ToolManager?.getActiveTool?.() === TOOL_DELETE) {
            cancelBuilding()
            return
          }

          map.fire('ui:openInfoPanel', {
            panelType: 'roadtrip',
            payload: {
              id: buildingId,
              stepCount: buildingStepIds.length,
              stepPlaceIds: buildingStepIds.slice(),
              isBuilding: true
            }
          })
        })
  
        layerRoadtripLines.addLayer(buildingPolyline)
      }
  
      function startBuilding() {
        building = true
        buildingId = newId()
        buildingStepIds = []
        buildingPolyline = null
      }
  
      function cancelBuilding() {
        if (buildingPolyline) {
          try { layerRoadtripLines.removeLayer(buildingPolyline) } catch {}
        }
        building = false
        buildingId = null
        buildingStepIds = []
        buildingPolyline = null
      }
  
      function finishBuilding() {
        if (!building) return
  
        // Il faut au moins 2 étapes pour avoir une trajectoire utile
        if (buildingStepIds.length < 2) {
          cancelBuilding()
          return
        }
  
        const id = buildingId
        const stepPlaceIds = buildingStepIds.slice()
        const polyline = buildingPolyline
  
        // clic ligne => suppression via outil delete
        polyline.on("click", () => {
          if (window.ToolManager?.getActiveTool?.() === TOOL_DELETE) {
            removeRoadtrip(id)
            return
          }

          const rt = roadtripsById.get(id)
          openRoadtripInfo(rt)
        })
  
        roadtripsById.set(id, { id, stepPlaceIds, polyline })
  
        // reset session
        building = false
        buildingId = null
        buildingStepIds = []
        buildingPolyline = null
      }
  
      function removeRoadtrip(id) {
        const rt = roadtripsById.get(id)
        if (!rt) return false
        try { layerRoadtripLines.removeLayer(rt.polyline) } catch {}
        try { rt.polyline.remove() } catch {}
        roadtripsById.delete(id)
        return true
      }
  
      function removeRoadtripsContainingPlace(placeId) {
        for (const [id, rt] of roadtripsById.entries()) {
          if (rt.stepPlaceIds.includes(placeId)) {
            removeRoadtrip(id)
          }
        }
  
        // si on est en train de build et que l'étape supprimée est dedans => on annule la session
        if (building && buildingStepIds.includes(placeId)) {
          cancelBuilding()
        }
      }
  
      function latlngForPlace(placeId) {
        const entry = window.PlacesApi?.placesById?.get(placeId)
        if (!entry) return null
        return L.latLng(entry.data.lat, entry.data.lng)
      }
  
      function addStepFromPlaceId(placeId) {
        if (!building) startBuilding()
  
        // évite les doublons consécutifs
        if (buildingStepIds.length > 0 && buildingStepIds[buildingStepIds.length - 1] === placeId) return
  
        buildingStepIds.push(placeId)
  
        const ll = latlngForPlace(placeId)
        if (!ll) return
  
        ensureBuildingPolyline()
        buildingPolyline.addLatLng(ll)
      }
  
      function createDefaultStepPlace(latlng, iso3) {
        // étape = place "par défaut"
        // tu peux changer le type plus tard
        const created = window.PlacesApi?.createPlace?.({
          lat: latlng.lat,
          lng: latlng.lng,
          type: "VISITED",
          label: "Étape",
          countryIso2: iso3, // ton createPlace accepte iso3 (car makeFlagIcon convertit)
        })
  
        if (!created) return null
        return created.data.id
      }
  
      // =============================
      // TOOL MANAGER / UI
      // =============================
      if (toolAddRoadTrip) {
        toolAddRoadTrip.addEventListener("click", () => {
          window.ToolManager?.toggleTool?.(TOOL_ROADTRIP)
  
          // activer automatiquement l'affichage des roadtrips
          if (filterRoadtrips) {
            filterRoadtrips.checked = true
            setLinesVisible(true)
          }
        })
      }
  
      window.ToolManager?.onChange?.((active) => {
        const isActive = active === TOOL_ROADTRIP
        toolAddRoadTrip?.classList.toggle("active", isActive)
  
        // curseur
        map.getContainer().style.cursor = isActive ? "crosshair" : ""
  
        // session
        if (isActive && !building) startBuilding()
        if (!isActive && building) cancelBuilding()
  
        // dblclick zoom: on le coupe pendant roadtrip
        if (map.doubleClickZoom) {
          if (isActive) map.doubleClickZoom.disable()
          else map.doubleClickZoom.enable()
        }
      })
  
      // filtre: affiche/masque les lignes
      if (filterRoadtrips) {
        filterRoadtrips.addEventListener("change", () => {
          setLinesVisible(filterRoadtrips.checked)
  
          // si on coupe l'affichage, on coupe aussi l'outil roadtrip s'il est actif
          if (!filterRoadtrips.checked && window.ToolManager?.getActiveTool?.() === TOOL_ROADTRIP) {
            window.ToolManager.setActiveTool(null)
          }
        })
        setLinesVisible(filterRoadtrips.checked)
      } else {
        setLinesVisible(true)
      }
  
      // =============================
      // EVENTS BRIDGE (depuis leafletPlaces + leafletCountries)
      // =============================
  
      // 1) clic sur un pays (ta logique existante): on crée une place étape à cet endroit
      map.on("country:click", ({ iso3, latlng }) => {
        if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
  
        const placeId = createDefaultStepPlace(latlng, iso3)
        if (placeId) addStepFromPlaceId(placeId)
      })
  
      // 2) clic sur une place existante: on la prend comme étape (au lieu d'en créer une nouvelle)
      map.on("place:click", ({ placeId }) => {
        if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
        if (!placeId) return
        addStepFromPlaceId(placeId)
      })
  
      // 3) suppression d'une place: si elle est dans un roadtrip => supprimer le roadtrip
      map.on("place:removed", ({ placeId }) => {
        if (!placeId) return
        removeRoadtripsContainingPlace(placeId)
      })
  
      // 4) double-clic sur la map => termine le roadtrip (sans zoom)
      map.on("dblclick", (e) => {
        if (window.ToolManager?.getActiveTool?.() !== TOOL_ROADTRIP) return
        if (e?.originalEvent) {
          e.originalEvent.preventDefault?.()
          e.originalEvent.stopPropagation?.()
        }
        finishBuilding()
        // on laisse l'outil actif => on peut en créer un autre directement
        startBuilding()
      })

      function openRoadtripInfo(rt) {
        if (!rt) return

        map.fire('ui:openInfoPanel', {
          panelType: 'roadtrip',
          payload: {
            id: rt.id,
            stepCount: rt.stepPlaceIds.length,
            stepPlaceIds: rt.stepPlaceIds
          }
        })
      }
  
      // expose debug
      return { roadtripsById, removeRoadtrip }
    }
  
    window.initRoadtrips = initRoadtrips
  })()