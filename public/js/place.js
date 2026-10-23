// public/js/place.js
// /place.html?id=...  -> un lieu : infos modifiables + photos/vidéos
//                        (galerie, visionneuse, ajout, suppression)
// /place.html         -> message "aucun lieu sélectionné"
//
// Dépend de : window.Api (api.js)
//   POST   /api/places/:id/media  (champ "files", plusieurs fichiers) -> médias créés
//   DELETE /api/media/:id                                            -> supprime aussi le fichier

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

  // Mêmes règles que le serveur (src/upload/multer.js)
  const MB = 1024 * 1024
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const VIDEO_TYPES = ['video/mp4', 'video/webm']
  const LIMITS = { photo: 20 * MB, video: 500 * MB, filesPerUpload: 30 }

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

  // Message d'erreur renvoyé par l'API ({ error: "..." }), sinon le message par défaut
  function apiErrorMessage(err, fallback) {
    try {
      const data = JSON.parse(err?.message)
      if (data?.error) return data.error
    } catch {
      // pas du JSON : erreur réseau, etc.
    }
    return fallback
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

  function formatSize(bytes) {
    return `${(bytes / MB).toFixed(1).replace('.', ',')} Mo`
  }

  function isVideo(media) {
    return media.mediaType === 'VIDEO'
  }

  function sortMedia(list) {
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
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
    // Un seul tableau partagé par la galerie et la visionneuse :
    // il est modifié sur place (ajout / suppression), jamais remplacé.
    const media = sortMedia((place.media || []).filter((m) => m.filePath))

    const lightbox = setupLightbox(media, place.name)
    const gallery = setupGallery(media, lightbox)

    setupUpload(place.id, (created) => {
      media.push(...created.filter((m) => m.filePath))
      sortMedia(media)
      gallery.render()
    })

    loadingEl.hidden = true
    view.hidden = false
  }

  // =============================
  // GALERIE + SUPPRESSION
  // =============================
  function setupGallery(media, lightbox) {
    const messageEl = view.querySelector('[data-photos-message]')
    const list = view.querySelector('[data-list="photos"]')
    const prevBtn = view.querySelector('[data-strip-prev]')
    const nextBtn = view.querySelector('[data-strip-next]')

    // ---- bande horizontale : flèches + molette ----
    function updateArrows() {
      const max = list.scrollWidth - list.clientWidth
      const scrollable = !list.hidden && max > 1
      prevBtn.hidden = !scrollable
      nextBtn.hidden = !scrollable
      prevBtn.disabled = list.scrollLeft <= 1
      nextBtn.disabled = list.scrollLeft >= max - 1
    }

    // une "page" = presque toute la largeur visible
    function scrollPage(dir) {
      list.scrollBy({ left: dir * list.clientWidth * 0.9, behavior: 'smooth' })
    }

    prevBtn.addEventListener('click', () => scrollPage(-1))
    nextBtn.addEventListener('click', () => scrollPage(1))
    list.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)

    // molette verticale au-dessus de la bande -> défilement horizontal
    // (aux extrémités, on laisse la page défiler normalement)
    list.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = list.scrollWidth - list.clientWidth
      if (max <= 1) return
      if ((e.deltaY < 0 && list.scrollLeft <= 0) || (e.deltaY > 0 && list.scrollLeft >= max - 1)) return
      e.preventDefault()
      list.scrollLeft += e.deltaY
    }, { passive: false })

    function render() {
      setField(view, 'photoCount', media.length)

      fillList(view, 'photos', 'photo', media, (node, m, i) => {
        node.dataset.index = i
        node.dataset.id = m.id
        setThumb(node, m.filePath, isVideo(m), m.caption)
        node.querySelector('[data-play]').hidden = !isVideo(m)
        setField(node, 'caption', m.caption || '')
        node.querySelector('[data-field="caption"]').hidden = !m.caption
      })

      // peu de photos : elles se partagent toute la largeur (voir .photo-strip en CSS)
      list.style.setProperty('--count', Math.max(media.length, 1))
      requestAnimationFrame(updateArrows) // après affichage de la page
    }

    function closeConfirms(except) {
      list.querySelectorAll('[data-confirm]').forEach((c) => {
        if (c !== except) c.hidden = true
      })
    }

    function setTileBusy(tile, busy) {
      tile.classList.toggle('is-busy', busy)
      tile.querySelectorAll('button').forEach((b) => { b.disabled = busy })
    }

    async function deleteTile(tile) {
      const id = tile.dataset.id
      setTileBusy(tile, true)
      showMessage(messageEl, null)

      // vidéo : libère le fichier avant suppression (Windows refuse de supprimer un fichier ouvert)
      const vid = tile.querySelector('[data-video]')
      if (vid?.getAttribute('src')) {
        vid.removeAttribute('src')
        vid.load()
      }

      try {
        await Api.deleteMedia(id)
      } catch (err) {
        // déjà supprimé ailleurs (404) : on le retire quand même de la galerie
        const notFound = /not found/i.test(apiErrorMessage(err, ''))
        if (!notFound) {
          console.error('Erreur suppression média:', err)
          setTileBusy(tile, false)
          showMessage(messageEl, apiErrorMessage(err, 'Impossible de supprimer ce fichier. Réessaie.'))
          return
        }
      }

      const index = media.findIndex((m) => m.id === id)
      if (index !== -1) media.splice(index, 1)
      render()
    }

    list.addEventListener('click', (e) => {
      const tile = e.target.closest('.photo-tile')
      if (!tile || tile.classList.contains('is-busy')) return
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
        deleteTile(tile)
      }
    })

    // Échap ferme les confirmations ouvertes
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeConfirms(null)
    })

    render()
    return { render }
  }

  // =============================
  // AJOUT
  // =============================
  // onUploaded(createdMedia[]) est appelé après un envoi réussi
  function setupUpload(placeId, onUploaded) {
    const openBtn = view.querySelector('[data-upload-open]')
    const panel = view.querySelector('[data-upload-panel]')
    const input = panel.querySelector('[data-upload-input]')
    const drop = panel.querySelector('.cover-drop')
    const sendBtn = panel.querySelector('[data-upload-send]')
    const cancelBtn = panel.querySelector('[data-upload-cancel]')
    const messageEl = panel.querySelector('[data-upload-message]')
    const progressEl = panel.querySelector('[data-upload-progress]')
    const pendingList = panel.querySelector('[data-list="pending"]')

    let pending = [] // [{ file, url }]
    let busy = false

    function render() {
      fillList(panel, 'pending', 'pending', pending, (node, p, i) => {
        node.dataset.index = i
        setThumb(node, p.url, VIDEO_TYPES.includes(p.file.type), p.file.name)
        setField(node, 'filename', p.file.name)
        node.querySelector('[data-pending-remove]').disabled = busy
      })
      setField(panel, 'pendingCount', pending.length ? `(${pending.length})` : '')
      sendBtn.disabled = busy || pending.length === 0
      cancelBtn.disabled = busy
      input.disabled = busy
      drop.classList.toggle('is-disabled', busy)
    }

    function setBusy(value) {
      busy = value
      render()
    }

    // fraction entre 0 et 1, null = masquer
    function setProgress(fraction) {
      if (fraction == null) {
        progressEl.hidden = true
        progressEl.value = 0
        return
      }
      progressEl.hidden = false
      progressEl.value = Math.round(fraction * 100)
    }

    // raison du refus d'un fichier, ou null s'il est accepté
    function rejectReason(file) {
      if (IMAGE_TYPES.includes(file.type)) {
        return file.size > LIMITS.photo ? `trop lourde (${formatSize(file.size)}, 20 Mo max)` : null
      }
      if (VIDEO_TYPES.includes(file.type)) {
        return file.size > LIMITS.video ? `trop lourde (${formatSize(file.size)}, 500 Mo max)` : null
      }
      return 'format non accepté'
    }

    function addFiles(fileList) {
      if (busy) return
      const problems = []

      for (const file of fileList || []) {
        const reason = rejectReason(file)
        if (reason) {
          problems.push(`${file.name} : ${reason}`)
          continue
        }
        if (pending.length >= LIMITS.filesPerUpload) {
          problems.push(`${file.name} : ${LIMITS.filesPerUpload} fichiers maximum par envoi`)
          continue
        }
        pending.push({ file, url: URL.createObjectURL(file) })
      }

      showMessage(messageEl, problems.length ? `Fichiers ignorés — ${problems.join(' · ')}` : null)
      input.value = '' // permet de re-choisir le même fichier
      render()
    }

    function reset() {
      pending.forEach((p) => URL.revokeObjectURL(p.url))
      pending = []
      setProgress(null)
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
      if (!busy) drop.classList.add('is-dragover')
    })
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'))
    drop.addEventListener('drop', (e) => {
      e.preventDefault()
      drop.classList.remove('is-dragover')
      addFiles(e.dataTransfer.files)
    })

    // retirer un fichier avant envoi
    pendingList.addEventListener('click', (e) => {
      if (busy || !e.target.closest('[data-pending-remove]')) return
      const i = Number(e.target.closest('.photo-tile').dataset.index)
      URL.revokeObjectURL(pending[i].url)
      pending.splice(i, 1)
      render()
    })

    cancelBtn.addEventListener('click', () => {
      if (busy) return
      reset()
      open(false)
    })

    // ---- envoi : tous les fichiers en une requête ----
    sendBtn.addEventListener('click', async () => {
      if (busy || pending.length === 0) return

      setBusy(true)
      showMessage(messageEl, null)
      setProgress(0)

      try {
        const files = pending.map((p) => p.file)
        const created = await Api.uploadPlaceMedia(placeId, files, { onProgress: setProgress })

        busy = false
        reset()
        open(false)
        onUploaded(Array.isArray(created) ? created : [])
      } catch (err) {
        // en cas d'erreur, le serveur n'a rien gardé : les fichiers restent à envoyer
        console.error('Erreur envoi médias:', err)
        setProgress(null)
        showMessage(messageEl, apiErrorMessage(err, "Impossible d'envoyer les fichiers. Réessaie."))
      } finally {
        setBusy(false)
      }
    })

    render()
  }

  // =============================
  // VISIONNEUSE
  // =============================
  // media : tableau partagé avec la galerie (lu à chaque ouverture)
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
      if (!media[i]) return
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

    // arrête la vidéo et libère le fichier à la fermeture
    dialog.addEventListener('close', () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    })

    return { open }
  }
})()