// public/js/search.js
// Recherche de lieux dans la sidebar (index.html), via /api/geocode/search (Nominatim).
//
// - Entrée / "Go" : lance la recherche (pas de recherche à chaque frappe : règle Nominatim)
// - clic sur un résultat : centre la carte + repère temporaire
// - "Ajouter ce lieu" : choix du type et du statut, puis création en base
//   (source NOMINATIM) et ouverture du panneau d'info du nouveau lieu
// - un résultat déjà enregistré propose "Voir mon lieu" au lieu d'"Ajouter"
//
// Dépend de : window.Api (api.js), window.PlacesApi (leafletPlaces.js), Leaflet
// Expose     : window.initSearch(map) -> { search, clear }

(function () {
  const TYPE_LABELS = {
    DEFAULT: 'Lieu',
    CITY: 'Ville',
    HIKE: 'Randonnée',
    ACTIVITY: 'Activité',
    VIEWPOINT: 'Point de vue',
  }

  const TYPE_ICONS = {
    DEFAULT: 'bi-geo-alt',
    CITY: 'bi-buildings',
    HIKE: 'bi-backpack',
    ACTIVITY: 'bi-bicycle',
    VIEWPOINT: 'bi-camera',
  }

  const RESULT_LIMIT = 6
  const NEAR = 0.001 // ≈ 100 m : même lieu si même nom et aussi proche

  function initSearch(map) {
    // =============================
    // DOM
    // =============================
    const form = document.querySelector('[data-search-form]')
    const results = document.querySelector('[data-search-results]')
    if (!form || !results) return null

    const input = form.querySelector('input[name="q"]')
    const submitBtn = form.querySelector('button[type="submit"]')
    const statusEl = results.querySelector('[data-search-status]')
    const list = results.querySelector('[data-search-list]')
    const itemTpl = results.querySelector('template[data-search-item]')
    const clearBtn = results.querySelector('[data-search-clear]')

    let requestId = 0     // ignore les réponses d'une recherche dépassée
    let searchMarker = null

    // =============================
    // HELPERS
    // =============================
    // type : 'info' | 'loading' | 'error'
    function setStatus(text, type = 'info') {
      statusEl.textContent = text || ''
      statusEl.dataset.type = type
    }

    // l'API renvoie { error: "..." } dans le message d'erreur (voir api.js -> request)
    function errorText(err, fallback) {
      try {
        const body = JSON.parse(err.message)
        if (body?.error) return body.error
      } catch {
        // pas du JSON
      }
      return fallback
    }

    // "Kyoto, Préfecture de Kyoto, Japon" -> "Préfecture de Kyoto, Japon"
    function detailOf(item) {
      const parts = String(item.displayName || '').split(',').map((p) => p.trim())
      if (parts[0] && parts[0] === item.name) parts.shift()
      return parts.join(', ')
    }

    // lieu déjà enregistré ? même id Nominatim, ou même nom très proche
    function findExisting(item) {
      const places = window.PlacesApi?.placesById
      if (!places) return null
      for (const entry of places.values()) {
        const d = entry.data
        if (item.nominatimPlaceId && d.nominatimPlaceId === item.nominatimPlaceId) return entry
        if (
          String(d.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase() &&
          Math.abs(d.lat - item.lat) < NEAR &&
          Math.abs(d.lng - item.lng) < NEAR
        ) return entry
      }
      return null
    }

    function openPlacePanel(entry) {
      map.setView([entry.data.lat, entry.data.lng], Math.max(map.getZoom(), 12))
      map.fire('ui:openInfoPanel', { panelType: 'place', payload: entry.data })
    }

    // =============================
    // CARTE : centrage + repère temporaire
    // =============================
    function removeSearchMarker() {
      if (searchMarker) {
        searchMarker.remove()
        searchMarker = null
      }
    }

    function focusResult(item) {
      removeSearchMarker()

      searchMarker = L.circleMarker([item.lat, item.lng], {
        radius: 10,
        color: 'rgba(120, 200, 160, 1)',
        weight: 3,
        fillColor: 'rgba(120, 200, 160, 1)',
        fillOpacity: 0.25,
        interactive: false,
      })
        .addTo(map)
        .bindTooltip(item.name, { direction: 'top', offset: [0, -10] })
        .openTooltip()

      // une zone (ville, pays...) : on la cadre ; un point : zoom fixe
      const [south, north, west, east] = item.bbox || []
      const isArea = item.bbox && Math.abs(north - south) > 0.005 && Math.abs(east - west) > 0.005

      if (isArea) {
        map.fitBounds([[south, west], [north, east]], { padding: [40, 40], maxZoom: 14 })
      } else {
        map.setView([item.lat, item.lng], 14)
      }
    }

    function setActive(li) {
      list.querySelectorAll('.search-item.is-active').forEach((el) => el.classList.remove('is-active'))
      li?.classList.add('is-active')
    }

    // =============================
    // RÉSULTATS
    // =============================
    function renderItem(item) {
      const li = itemTpl.content.firstElementChild.cloneNode(true)
      const addBtn = li.querySelector('[data-search-add]')
      const openBtn = li.querySelector('[data-search-open]')
      const note = li.querySelector('[data-search-note]')
      const addForm = li.querySelector('[data-search-add-form]')
      const addError = li.querySelector('[data-search-add-error]')

      li.querySelector('[data-search-icon]').className = `bi ${TYPE_ICONS[item.suggestedType] || 'bi-geo-alt'}`
      li.querySelector('[data-search-name]').textContent = item.name
      li.querySelector('[data-search-detail]').textContent =
        [TYPE_LABELS[item.suggestedType], detailOf(item)].filter(Boolean).join(' · ')

      // état : déjà enregistré / pays absent de la base / ajoutable
      function refreshState() {
        const existing = findExisting(item)
        if (existing) addForm.hidden = true
        addBtn.hidden = !!existing || !addForm.hidden // caché aussi pendant le choix des options
        openBtn.hidden = !existing

        const noCountry = !existing && !item.countryId
        addBtn.disabled = noCountry
        note.hidden = !noCountry
        note.textContent = noCountry
          ? `Pays absent de ta base${item.countryName ? ` (${item.countryName})` : ''} : impossible de l'ajouter.`
          : ''
        return existing
      }

      // centrer
      li.querySelector('[data-search-go]').addEventListener('click', () => {
        setActive(li)
        focusResult(item)
      })

      // voir le lieu déjà enregistré
      openBtn.addEventListener('click', () => {
        const existing = findExisting(item)
        if (!existing) return refreshState()
        removeSearchMarker()
        setActive(li)
        openPlacePanel(existing)
      })

      // ouvrir les options d'ajout
      addBtn.addEventListener('click', () => {
        setActive(li)
        focusResult(item)
        addForm.querySelector('select[name="type"]').value = item.suggestedType || 'DEFAULT'
        addForm.hidden = false
        addBtn.hidden = true
        addError.hidden = true
      })

      li.querySelector('[data-search-add-cancel]').addEventListener('click', () => {
        addForm.hidden = true
        addBtn.hidden = false
      })

      // créer le lieu
      addForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (findExisting(item)) {
          addForm.hidden = true
          refreshState()
          return
        }

        const fd = new FormData(addForm)
        const payload = {
          countryId: item.countryId,
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          type: fd.get('type') || 'DEFAULT',
          visited: fd.get('visited') === 'true',
          source: 'NOMINATIM',
          nominatimPlaceId: item.nominatimPlaceId,
          nominatimName: item.displayName,
        }

        const buttons = addForm.querySelectorAll('button, select, input')
        buttons.forEach((el) => { el.disabled = true })
        addError.hidden = true

        try {
          const entry = await window.PlacesApi.createPlaceFromApi(payload)
          addForm.hidden = true
          refreshState()
          removeSearchMarker()
          openPlacePanel(entry)
        } catch (err) {
          console.error('Erreur ajout lieu depuis la recherche:', err)
          addError.textContent = errorText(err, "Impossible d'ajouter ce lieu. Réessaie.")
          addError.hidden = false
        } finally {
          buttons.forEach((el) => { el.disabled = false })
        }
      })

      li.refreshState = refreshState
      refreshState()
      return li
    }

    // =============================
    // RECHERCHE
    // =============================
    async function search(rawQuery) {
      const q = String(rawQuery || '').trim()
      results.hidden = false

      if (q.length < 2) {
        list.replaceChildren()
        setStatus('Tape au moins 2 caractères.', 'error')
        return
      }

      const id = ++requestId
      list.replaceChildren()
      removeSearchMarker()
      setStatus('Recherche…', 'loading')
      submitBtn.disabled = true

      try {
        const items = await window.Api.searchPlaces(q, { limit: RESULT_LIMIT })
        if (id !== requestId) return // une autre recherche a été lancée entre-temps

        list.replaceChildren(...items.map(renderItem))
        setStatus(items.length
          ? `${items.length} résultat${items.length > 1 ? 's' : ''} pour « ${q} »`
          : `Aucun résultat pour « ${q} »`)

        // un seul résultat : on centre directement
        if (items.length === 1) {
          setActive(list.firstElementChild)
          focusResult(items[0])
        }
      } catch (err) {
        if (id !== requestId) return
        console.error('Erreur recherche de lieux:', err)
        setStatus(errorText(err, 'La recherche a échoué. Réessaie.'), 'error')
      } finally {
        if (id === requestId) submitBtn.disabled = false
      }
    }

    function clear() {
      requestId++
      list.replaceChildren()
      results.hidden = true
      submitBtn.disabled = false
      removeSearchMarker()
    }

    // =============================
    // ÉVÉNEMENTS
    // =============================
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      search(input.value)
    })

    clearBtn.addEventListener('click', () => {
      clear()
      input.value = ''
      input.focus()
    })

    // Échap dans le champ : efface la recherche
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !results.hidden) {
        e.preventDefault()
        clear()
      }
    })

    // un lieu ajouté ou supprimé (ici ou depuis la carte) : on met à jour
    // les boutons "Ajouter" / "Voir mon lieu" des résultats affichés
    map.on('place:created place:removed', () => {
      if (results.hidden) return
      list.querySelectorAll('.search-item').forEach((li) => li.refreshState?.())
    })

    return { search, clear }
  }

  window.initSearch = initSearch
})()