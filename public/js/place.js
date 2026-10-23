// public/js/place.js
// /place.html?id=...  -> un lieu : infos modifiables + photos (galerie, visionneuse)
// /place.html         -> message "aucun lieu sélectionné"
//
// Dépend de : window.Api (api.js)
// Photos : ajout et suppression = interface seulement, pas encore branchées
//          (voir les TODO plus bas).

(function () {
  // =============================
  // LIBELLÉS
  // =============================
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

  // =============================
  // HELPERS
  // =============================
  // Remplit tous les [data-field="name"] sous root (textContent : pas d'injection HTML)
  function setField(root, name, value) {
    root.querySelectorAll(`[data-field="${name}"]`).forEach((el) => {
      el.textContent = value ?? ''
    })
  }

  // Remplit <ul data-list="listName"> avec <template data-item="itemName">
  function fillList(root, listName, itemName, items, fillItem) {
    const list = root.querySelector(`[data-list="${listName}"]`)
    const itemTpl = root.querySelector(`template[data-item="${itemName}"]`)
    const empty = root.querySelector(`[data-empty="${listName}"]`)
    if (!list || !itemTpl) return

    list.replaceChildren()
    items.forEach((item, i) => {
      const node = itemTpl.content.firstElementChild.cloneNode(true)
      fillItem(node, item, i)
      list.append(node)
    })

    list.hidden = items.length === 0
    if (empty) empty.hidden = items.length > 0
  }

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

  function toDateInputValue(value) {
    return value ? String(value).slice(0, 10) : ''
  }

  function flagUrl(iso2) {
    return iso2 ? `/resources/${String(iso2).toLowerCase()}.png` : ''
  }

  function isVideo(media) {
    return media.mediaType === 'VIDEO'
  }

  // vignette : <img> pour une photo, <video> (1re image) pour une vidéo
  function setThumb(node, src, video, alt) {
    const img = node.querySelector('[data-img]')
    const vid = node.querySelector('[data-video]')
    if (video) {
      vid.src = src
      vid.hidden = false
      img.hidden = true
    } else {
      img.src = src
      img.alt = alt || ''
      img.hidden = false
      img.onerror = () => node.classList.add('is-broken')
      vid.hidden = true
    }
  }

  // =============================
  // DÉMARRAGE
  // =============================
  const view = document.querySelector('[data-view="detail"]')
  const missingView = document.querySelector('[data-view="missing"]')
  const loadingEl = document.querySelector('[data-page-loading]')
  const pageError = document.querySelector('[data-page-error]')

  const placeId = new URLSearchParams(window.location.search).get('id')

  if (!placeId) {
    loadingEl.hidden = true
    missingView.hidden = false
  } else {
    showPlace(placeId).catch((err) => {
      console.error(err)
      loadingEl.hidden = true
      showMessage(pageError, 'Impossible de charger ce lieu.')
    })
  }

  // =============================
  // PAGE
  // =============================
  async function showPlace(id) {
    let place = await Api.getPlace(id)

    const form = view.querySelector('[data-place-form]')
    const errorEl = form.querySelector('[data-place-error]')
    const savedEl = form.querySelector('[data-place-saved]')

    // ---------- en-tête ----------
    function renderHead() {
      document.title = `${place.name} · Travel Map`

      view.querySelector('[data-type-icon]').className = `bi ${TYPE_ICONS[place.type] || 'bi-geo-alt'}`
      setField(view, 'name', place.name)
      setField(view, 'typeLabel', TYPE_LABELS[place.type] || place.type)

      const badge = view.querySelector('[data-status]')
      badge.dataset.status = place.visited ? 'visited' : 'toVisit'
      badge.textContent = place.visited ? 'Visité' : 'À visiter'

      // pays + retour vers sa page
      const country = place.country
      const countryUrl = place.countryId ? `/country.html?id=${encodeURIComponent(place.countryId)}` : '/country.html'
      setField(view, 'countryName', country?.name || '')

      const countryLink = view.querySelector('[data-country-link]')
      countryLink.href = countryUrl
      countryLink.hidden = !country

      const flag = view.querySelector('[data-flag]')
      if (country?.iso2) {
        flag.src = flagUrl(country.iso2)
        flag.onerror = () => { flag.hidden = true }
      } else {
        flag.hidden = true
      }

      view.querySelector('[data-back-link]').href = countryUrl
      view.querySelector('[data-back-label]').textContent = country?.name || 'Mes pays'
    }

    // ---------- formulaire ----------
    function toggleVisitedAt(visited) {
      form.querySelector('[data-visited-at-field]').hidden = !visited
    }

    function renderForm() {
      formField(form, 'name').value = place.name || ''
      formField(form, 'type').value = place.type || 'DEFAULT'
      form.querySelector(`input[name="visited"][value="${place.visited ? 'true' : 'false'}"]`).checked = true
      formField(form, 'visitedAt').value = toDateInputValue(place.visitedAt)
      formField(form, 'description').value = place.description || ''
      formField(form, 'lat').value = place.lat ?? ''
      formField(form, 'lng').value = place.lng ?? ''
      toggleVisitedAt(!!place.visited)
    }

    form.addEventListener('change', (e) => {
      const radio = e.target.closest('input[name="visited"]')
      if (radio) toggleVisitedAt(radio.value === 'true')
    })

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      showMessage(errorEl, null)
      showMessage(savedEl, null)

      const fd = new FormData(form)
      const name = String(fd.get('name') || '').trim()
      const visited = fd.get('visited') === 'true'
      const lat = Number(fd.get('lat'))
      const lng = Number(fd.get('lng'))

      if (!name) return showMessage(errorEl, 'Le nom est obligatoire.')
      if (fd.get('lat') === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        return showMessage(errorEl, 'La latitude doit être comprise entre -90 et 90.')
      }
      if (fd.get('lng') === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return showMessage(errorEl, 'La longitude doit être comprise entre -180 et 180.')
      }

      const changes = {
        name,
        type: fd.get('type'),
        visited,
        visitedAt: visited ? (fd.get('visitedAt') || null) : null,
        description: String(fd.get('description') || '').trim() || null,
        lat,
        lng,
      }

      setFormBusy(form, true)
      try {
        const updated = await Api.updatePlace(place.id, changes)
        place = { ...place, ...updated }
        renderHead()
        renderForm()
        showMessage(savedEl, 'Modifications enregistrées.')
      } catch (err) {
        console.error('Erreur modification lieu:', err)
        showMessage(errorEl, "Impossible d'enregistrer les modifications. Réessaie.")
      } finally {
        setFormBusy(form, false)
      }
    })

    renderHead()
    renderForm()

    // ---------- photos ----------
    const media = [...(place.media || [])]
      .filter((m) => m.filePath)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const lightbox = setupLightbox(media, place.name)
    setupGallery(media, lightbox)
    setupUpload()

    loadingEl.hidden = true
    view.hidden = false
  }

  // =============================
  // GALERIE + SUPPRESSION (interface)
  // =============================
  function setupGallery(media, lightbox) {
    const messageEl = view.querySelector('[data-photos-message]')
    const list = view.querySelector('[data-list="photos"]')

    setField(view, 'photoCount', media.length)

    fillList(view, 'photos', 'photo', media, (node, m, i) => {
      node.dataset.index = i
      setThumb(node, m.filePath, isVideo(m), m.caption)
      node.querySelector('[data-play]').hidden = !isVideo(m)
      setField(node, 'caption', m.caption || '')
      node.querySelector('[data-field="caption"]').hidden = !m.caption
    })

    function closeConfirms(except) {
      list.querySelectorAll('[data-confirm]').forEach((c) => {
        if (c !== except) c.hidden = true
      })
    }

    list.addEventListener('click', (e) => {
      const tile = e.target.closest('.photo-tile')
      if (!tile) return
      const confirmBox = tile.querySelector('[data-confirm]')

      // agrandir
      if (e.target.closest('[data-open]')) {
        lightbox.open(Number(tile.dataset.index))
        return
      }

      // demander confirmation
      if (e.target.closest('[data-delete]')) {
        closeConfirms(confirmBox)
        confirmBox.hidden = !confirmBox.hidden
        return
      }

      if (e.target.closest('[data-confirm-no]')) {
        confirmBox.hidden = true
        return
      }

      // confirmer
      if (e.target.closest('[data-confirm-yes]')) {
        confirmBox.hidden = true
        // TODO : await Api.deleteMedia(media[index].id), puis retirer la vignette
        //        (et supprimer le fichier du disque côté serveur)
        showMessage(messageEl, "La suppression n'est pas encore branchée : la photo n'a pas été supprimée.")
      }
    })

    // Échap ferme les confirmations ouvertes
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeConfirms(null)
    })
  }

  // =============================
  // AJOUT (interface)
  // =============================
  function setupUpload() {
    const openBtn = view.querySelector('[data-upload-open]')
    const panel = view.querySelector('[data-upload-panel]')
    const input = panel.querySelector('[data-upload-input]')
    const drop = panel.querySelector('.cover-drop')
    const sendBtn = panel.querySelector('[data-upload-send]')
    const cancelBtn = panel.querySelector('[data-upload-cancel]')
    const messageEl = panel.querySelector('[data-upload-message]')
    const pendingList = panel.querySelector('[data-list="pending"]')

    let pending = [] // [{ file, url }]

    function render() {
      fillList(panel, 'pending', 'pending', pending, (node, p, i) => {
        node.dataset.index = i
        setThumb(node, p.url, p.file.type.startsWith('video/'), p.file.name)
        setField(node, 'filename', p.file.name)
      })
      setField(panel, 'pendingCount', pending.length ? `(${pending.length})` : '')
      sendBtn.disabled = pending.length === 0
    }

    function addFiles(fileList) {
      const files = [...(fileList || [])]
      const accepted = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))

      showMessage(messageEl, accepted.length < files.length
        ? 'Certains fichiers ont été ignorés : seules les photos et vidéos sont acceptées.'
        : null)

      for (const file of accepted) pending.push({ file, url: URL.createObjectURL(file) })
      input.value = '' // permet de re-choisir le même fichier
      render()
    }

    function reset() {
      pending.forEach((p) => URL.revokeObjectURL(p.url))
      pending = []
      showMessage(messageEl, null)
      render()
    }

    function open(isOpen) {
      panel.hidden = !isOpen
      openBtn.hidden = isOpen
      if (isOpen) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }

    openBtn.addEventListener('click', () => open(true))
    input.addEventListener('change', () => addFiles(input.files))

    drop.addEventListener('dragover', (e) => {
      e.preventDefault()
      drop.classList.add('is-dragover')
    })
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'))
    drop.addEventListener('drop', (e) => {
      e.preventDefault()
      drop.classList.remove('is-dragover')
      addFiles(e.dataTransfer.files)
    })

    // retirer un fichier avant envoi
    pendingList.addEventListener('click', (e) => {
      if (!e.target.closest('[data-pending-remove]')) return
      const i = Number(e.target.closest('.photo-tile').dataset.index)
      URL.revokeObjectURL(pending[i].url)
      pending.splice(i, 1)
      render()
    })

    cancelBtn.addEventListener('click', () => {
      reset()
      open(false)
    })

    sendBtn.addEventListener('click', () => {
      // TODO : FormData avec les fichiers -> POST (multer), puis recharger la galerie
      showMessage(messageEl, "L'envoi n'est pas encore branché : les fichiers n'ont pas été enregistrés.")
    })

    render()
  }

  // =============================
  // VISIONNEUSE
  // =============================
  function setupLightbox(media, placeName) {
    const dialog = document.querySelector('[data-lightbox]')
    const img = dialog.querySelector('[data-lightbox-img]')
    const video = dialog.querySelector('[data-lightbox-video]')
    const caption = dialog.querySelector('[data-lightbox-caption]')
    const counter = dialog.querySelector('[data-lightbox-counter]')
    const prev = dialog.querySelector('[data-lightbox-prev]')
    const next = dialog.querySelector('[data-lightbox-next]')

    let index = 0

    function render() {
      const m = media[index]
      if (!m) return

      video.pause()
      if (isVideo(m)) {
        video.src = m.filePath
        video.hidden = false
        img.hidden = true
      } else {
        img.src = m.filePath
        img.alt = m.caption || `${placeName} – photo ${index + 1}`
        img.hidden = false
        video.hidden = true
        video.removeAttribute('src')
      }

      caption.textContent = m.caption || ''
      caption.hidden = !m.caption
      counter.textContent = `${index + 1} / ${media.length}`

      const single = media.length < 2
      prev.hidden = single
      next.hidden = single
      counter.hidden = single
      prev.disabled = index === 0
      next.disabled = index === media.length - 1
    }

    function go(delta) {
      const target = index + delta
      if (target < 0 || target >= media.length) return
      index = target
      render()
    }

    function open(i) {
      index = i
      render()
      dialog.showModal()
    }

    prev.addEventListener('click', () => go(-1))
    next.addEventListener('click', () => go(1))
    dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close())

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    })

    // clic sur le fond sombre : fermer
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })

    dialog.addEventListener('close', () => video.pause())

    return { open }
  }
})()