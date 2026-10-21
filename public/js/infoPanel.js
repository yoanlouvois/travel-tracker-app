// public/js/InfoPanel.js
// Panneau d'info (pays / lieu / roadtrip) : chargement des modèles HTML
// (public/panels/*.html), rendu, et interactions (statut pays, édition et
// suppression de lieu).
//
// Dépend de : window.PlacesApi (leafletPlaces.js), window.CountriesApi (leafletCountries.js)
// Expose   : window.initInfoPanel(map) -> { show, close }

(function () {
  function initInfoPanel(map) {
    // =============================
    // DOM
    // =============================
    const infoPanel = document.getElementById('infoPanel')
    const btnCloseInfoPanel = document.getElementById('btnCloseInfoPanel')
    const infoPanelTitle = document.getElementById('infoPanelTitle')
    const infoPanelContent = document.getElementById('infoPanelContent')
    const mapWrap = document.querySelector('.map-wrap')

    if (!infoPanel || !infoPanelTitle || !infoPanelContent) {
      console.warn('InfoPanel : éléments #infoPanel / #infoPanelTitle / #infoPanelContent introuvables')
      return null
    }

    // =============================
    // MODÈLES HTML
    // =============================
    const PANEL_TEMPLATE_URLS = {
      country: '/panels/country.html',
      place: '/panels/place.html',
      roadtrip: '/panels/roadtrip.html',
    }

    const panelTemplates = {}

    // Chargés une seule fois au démarrage
    async function loadPanelTemplates() {
      await Promise.all(Object.entries(PANEL_TEMPLATE_URLS).map(async ([name, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Impossible de charger ${url}`)
        const tpl = document.createElement('template')
        tpl.innerHTML = await res.text()
        panelTemplates[name] = tpl
      }))
    }

    const panelTemplatesReady = loadPanelTemplates().catch((err) => {
      console.error('Erreur chargement des modèles du panneau:', err)
    })

    function clonePanel(name) {
      const tpl = panelTemplates[name]
      return tpl ? tpl.content.cloneNode(true) : null
    }

    // =============================
    // HELPERS DOM
    // =============================
    // Remplit tous les [data-field="name"] sous root (textContent : pas d'injection HTML)
    function setField(root, name, value) {
      root.querySelectorAll(`[data-field="${name}"]`).forEach((el) => {
        el.textContent = value ?? ''
      })
    }

    // Remplit <ul data-list="listName"> avec <template data-item="itemName">
    // et gère l'éventuel message [data-empty="listName"]
    function fillList(root, listName, itemName, items, fillItem) {
      const list = root.querySelector(`[data-list="${listName}"]`)
      const itemTpl = root.querySelector(`template[data-item="${itemName}"]`)
      const empty = root.querySelector(`[data-empty="${listName}"]`)
      if (!list || !itemTpl) return

      list.replaceChildren()
      for (const item of items) {
        const node = itemTpl.content.firstElementChild.cloneNode(true)
        fillItem(node, item)
        list.append(node)
      }

      list.hidden = items.length === 0
      if (empty) empty.hidden = items.length > 0
    }

    // Affiche un message dans un élément [hidden] (null = masquer)
    function showMessage(el, text) {
      if (!el) return
      el.textContent = text || ''
      el.hidden = !text
    }

    function formField(form, name) {
      return form.querySelector(`[name="${name}"]`)
    }

    function setFormBusy(form, busy) {
      form.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = busy
      })
    }

    // =============================
    // LIBELLÉS
    // =============================
    const PLACE_TYPE_LABELS = {
      VISITED: 'Visité',
      TO_VISIT: 'À visiter',
      CITY: 'Ville',
      HIKE: 'Randonnée',
      ACTIVITY: 'Activité',
      VIEWPOINT: 'Point de vue',
    }

    const typeLabel = (type) => PLACE_TYPE_LABELS[type] || type || '-'

    // =============================
    // RENDU : PAYS
    // =============================
    function renderCountryPanel(data = {}) {
      const root = clonePanel('country')
      if (!root) return null

      // couverture
      const cover = root.querySelector('[data-cover]')
      if (cover && data.coverImagePath) {
        cover.src = data.coverImagePath
        cover.hidden = false
      }

      // statut
      const status = data.status || 'none'
      const fieldset = root.querySelector('[data-country-status]')
      if (fieldset) {
        fieldset.dataset.iso3 = data.iso3 || ''
        fieldset.dataset.current = status
        fieldset.disabled = !data.id // pays absent de la base → non modifiable
        const radio = fieldset.querySelector(`input[value="${status}"]`)
        if (radio) radio.checked = true
      }

      // infos
      const stats = data.stats || {}
      setField(root, 'iso2', data.iso2 || '-')
      setField(root, 'iso3', data.iso3 || '-')
      setField(root, 'placesCount', stats.placesCount ?? 0)
      setField(root, 'visitedPlacesCount', stats.visitedPlacesCount ?? 0)

      // stats par type
      const byType = Object.entries(stats.placesByType || {})
      fillList(root, 'stats', 'stat', byType, (node, [type, count]) => {
        setField(node, 'label', typeLabel(type))
        setField(node, 'count', count)
      })

      // lieux
      const places = [...(data.places || [])].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
      fillList(root, 'places', 'place', places, (node, place) => {
        node.dataset.placeId = place.id
        setField(node, 'label', place.label)
        setField(node, 'type', typeLabel(place.type))
      })

      // lien vers la page pays
      const link = root.querySelector('[data-page-link]')
      if (link && data.id) {
        link.href = `country.html?id=${encodeURIComponent(data.id)}`
        link.hidden = false
      }

      return root
    }

    // =============================
    // RENDU : LIEU
    // =============================
    function toggleVisitedAt(form, visited) {
      const field = form.querySelector('[data-visited-at-field]')
      if (field) field.hidden = !visited
    }

    function renderPlacePanel(data = {}) {
      const root = clonePanel('place')
      if (!root) return null

      // formulaire
      const form = root.querySelector('[data-place-form]')
      if (form) {
        form.dataset.placeId = data.id || ''

        const name = formField(form, 'name')
        if (name) name.value = data.name ?? data.label ?? ''

        const type = formField(form, 'type')
        if (type) type.value = data.apiType || 'DEFAULT'

        const visitedValue = data.visited ? 'true' : 'false'
        const radio = form.querySelector(`input[name="visited"][value="${visitedValue}"]`)
        if (radio) radio.checked = true

        const visitedAt = formField(form, 'visitedAt')
        if (visitedAt) visitedAt.value = data.visitedAt ? String(data.visitedAt).slice(0, 10) : ''

        const description = formField(form, 'description')
        if (description) description.value = data.description ?? ''

        toggleVisitedAt(form, !!data.visited)
      }

      // infos en lecture seule
      setField(root, 'country', data.country?.name || data.countryIso2?.toUpperCase() || '-')
      setField(
        root,
        'coords',
        Number.isFinite(data.lat) && Number.isFinite(data.lng)
          ? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`
          : '-'
      )

      // photos / vidéos
      const media = [...(data.media || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      fillList(root, 'media', 'media', media, (node, m) => {
        const img = node.querySelector('[data-media-img]')
        const video = node.querySelector('[data-media-video]')

        if (m.mediaType === 'VIDEO' && video) {
          video.src = m.filePath
          video.hidden = false
        } else if (img) {
          img.src = m.filePath
          img.alt = m.caption || ''
          img.hidden = false
        }

        setField(node, 'caption', m.caption || '')
      })

      // suppression
      const del = root.querySelector('[data-place-delete]')
      if (del) del.dataset.placeId = data.id || ''

      return root
    }

    // =============================
    // RENDU : ROADTRIP
    // =============================
    function renderRoadtripPanel(data = {}) {
      const root = clonePanel('roadtrip')
      if (!root) return null

      setField(root, 'stepCount', data.stepCount ?? 0)
      setField(root, 'id', data.id ?? '-')

      return root
    }

    const PANEL_RENDERERS = {
      country: { render: renderCountryPanel, title: (d) => d?.name || 'Pays', key: (d) => d?.iso3 },
      place: { render: renderPlacePanel, title: (d) => d?.label || 'Lieu', key: (d) => d?.id },
      roadtrip: {
        render: renderRoadtripPanel,
        title: (d) => (d?.isBuilding ? 'Roadtrip en cours' : 'Roadtrip'),
        key: (d) => d?.id,
      },
    }

    // =============================
    // OUVERTURE / FERMETURE
    // =============================
    let currentPanel = null // { type, key } : ce qui est affiché dans le panneau
    let renderToken = 0     // évite qu'un rendu en retard écrase un rendu plus récent

    function invalidateMapSize() {
      setTimeout(() => map.invalidateSize(), 200)
    }

    // content : un Node (fragment cloné depuis un modèle)
    function open({ title = 'Infos', content = null } = {}) {
      infoPanelTitle.textContent = title

      if (content) {
        infoPanelContent.replaceChildren(content)
      } else {
        const empty = document.createElement('p')
        empty.textContent = 'Aucun contenu.'
        infoPanelContent.replaceChildren(empty)
      }

      infoPanel.classList.add('open')
      mapWrap?.classList.add('info-panel-open')
      invalidateMapSize()
    }

    function close() {
      infoPanel.classList.remove('open')
      mapWrap?.classList.remove('info-panel-open')
      currentPanel = null
      renderToken++ // annule un rendu en attente
      invalidateMapSize()
    }

    // Ouvre (ou re-rend) le panneau pour un type donné
    async function show(type, data) {
      const renderer = PANEL_RENDERERS[type]
      if (!renderer) return false

      const token = ++renderToken
      await panelTemplatesReady
      if (token !== renderToken) return false

      currentPanel = { type, key: renderer.key(data) }
      open({
        title: renderer.title(data),
        content: renderer.render(data),
      })
      return true
    }

    function isShowing(type, key) {
      return infoPanel.classList.contains('open')
        && currentPanel?.type === type
        && (key === undefined || currentPanel.key === key)
    }

    btnCloseInfoPanel?.addEventListener('click', close)

    // =============================
    // ÉVÉNEMENTS CARTE
    // =============================
    map.on('ui:openInfoPanel', (e) => {
      show(e.panelType, e.payload)
    })

    // Le pays affiché a changé (panneau ou outils de la carte) → on re-rend
    map.on('country:updated', ({ iso3, payload }) => {
      if (isShowing('country', iso3)) show('country', payload)
    })

    // Un lieu a été modifié ailleurs → on re-rend son panneau s'il est affiché
    map.on('place:updated', ({ placeId, data }) => {
      if (isShowing('place', placeId)) show('place', data)
    })

    // Le lieu affiché a été supprimé → on ferme le panneau
    map.on('place:removed', ({ placeId }) => {
      if (isShowing('place', placeId)) close()
    })

    // Un panneau pays ouvert doit refléter les lieux ajoutés / modifiés / supprimés
    map.on('place:created place:updated place:removed', () => {
      if (!isShowing('country')) return
      const payload = window.CountriesApi?.buildCountryPanelPayload?.(currentPanel.key)
      if (payload) show('country', payload)
    })

    // =============================
    // INTERACTIONS : CHANGEMENTS
    // =============================
    infoPanelContent.addEventListener('change', async (e) => {
      // statut d'un lieu → afficher / masquer la date de visite
      const placeVisited = e.target.closest('[data-place-form] input[name="visited"]')
      if (placeVisited) {
        toggleVisitedAt(placeVisited.form, placeVisited.value === 'true')
        return
      }

      // statut d'un pays
      const input = e.target.closest('input[name="countryStatus"]')
      if (!input) return

      const fieldset = input.closest('[data-country-status]')
      const errorEl = infoPanelContent.querySelector('[data-country-status-error]')
      const iso3 = fieldset.dataset.iso3
      const previous = fieldset.dataset.current

      if (!window.CountriesApi?.setCountryStatus) {
        console.error('CountriesApi introuvable')
        return
      }

      fieldset.disabled = true
      showMessage(errorEl, null)

      try {
        // en cas de succès, 'country:updated' re-rend tout le panneau
        await window.CountriesApi.setCountryStatus(iso3, input.value)
      } catch (err) {
        console.error('Erreur changement statut pays:', err)

        const prevInput = fieldset.querySelector(`input[value="${previous}"]`)
        if (prevInput) prevInput.checked = true
        fieldset.disabled = false
        showMessage(errorEl, "Impossible d'enregistrer le statut. Réessaie.")
      }
    })

    // =============================
    // INTERACTIONS : ENREGISTRER UN LIEU
    // =============================
    infoPanelContent.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-place-form]')
      if (!form) return
      e.preventDefault()

      const id = form.dataset.placeId
      const errorEl = form.querySelector('[data-place-error]')
      const savedEl = form.querySelector('[data-place-saved]')
      showMessage(errorEl, null)
      showMessage(savedEl, null)

      const fd = new FormData(form)
      const name = String(fd.get('name') || '').trim()
      const visited = fd.get('visited') === 'true'

      if (!name) {
        showMessage(errorEl, 'Le nom est obligatoire.')
        return
      }

      const changes = {
        name,
        type: fd.get('type'),
        visited,
        visitedAt: visited ? (fd.get('visitedAt') || null) : null,
        description: String(fd.get('description') || '').trim() || null,
      }

      setFormBusy(form, true)
      const entry = await window.PlacesApi?.updatePlace?.(id, changes)

      if (!entry) {
        setFormBusy(form, false)
        showMessage(errorEl, "Impossible d'enregistrer les modifications. Réessaie.")
        return
      }

      // re-rendu avec les données renvoyées par le serveur, puis confirmation
      const shown = await show('place', entry.data)
      if (shown) {
        showMessage(infoPanelContent.querySelector('[data-place-saved]'), 'Modifications enregistrées.')
      }
    })

    // =============================
    // INTERACTIONS : CLICS
    // =============================
    function openPlaceFromList(item) {
      const entry = window.PlacesApi?.placesById.get(item.dataset.placeId)
      if (!entry) return

      map.flyTo([entry.data.lat, entry.data.lng], Math.max(map.getZoom(), 8))
      map.fire('ui:openInfoPanel', { panelType: 'place', payload: entry.data })
    }

    infoPanelContent.addEventListener('click', async (e) => {
      // suppression d'un lieu
      const delBtn = e.target.closest('[data-place-delete]')
      if (delBtn) {
        const id = delBtn.dataset.placeId
        const entry = window.PlacesApi?.placesById.get(id)
        if (!entry) return

        const ok = window.confirm(
          `Supprimer « ${entry.data.label} » ?\n` +
          'Ses photos seront supprimées. Les roadtrips qui passent par ce lieu gardent l\'étape.'
        )
        if (!ok) return

        delBtn.disabled = true
        const deleted = await window.PlacesApi.deletePlace(id)
        if (!deleted) {
          delBtn.disabled = false
          showMessage(infoPanelContent.querySelector('[data-place-error]'), 'Impossible de supprimer ce lieu. Réessaie.')
        }
        // en cas de succès, 'place:removed' ferme le panneau
        return
      }

      // lieu dans la liste d'un pays (li uniquement : le formulaire et le bouton
      // supprimer portent aussi un data-place-id)
      const item = e.target.closest('li[data-place-id]')
      if (item) openPlaceFromList(item)
    })

    infoPanelContent.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const item = e.target.closest('li[data-place-id]')
      if (!item) return
      e.preventDefault()
      openPlaceFromList(item)
    })

    // =============================
    // API PUBLIQUE
    // =============================
    const publicApi = { show, close, isShowing }
    window.InfoPanel = publicApi
    return publicApi
  }

  window.initInfoPanel = initInfoPanel
})()