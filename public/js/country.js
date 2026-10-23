// public/js/country.js
// /country.html          -> liste des pays visités (ordre alphabétique, drapeaux)
// /country.html?id=...   -> fiche d'un pays : couverture (changer / retirer),
//                           statut modifiable, chiffres, lieux en cartes (1 photo max par lieu)
//
// Dépend de : window.Api (api.js), window.IsoCodes (map/isoCodes.js)

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

  const STATUS_LABELS = {
    visited: 'Visité',
    toVisit: 'À visiter',
    none: 'Pas visité',
  }

  // Couverture : mêmes règles que le serveur (src/upload/multer.js)
  const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const COVER_MAX_BYTES = 20 * 1024 * 1024

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

  function plural(count, singular, pluralForm) {
    return `${count} ${count > 1 ? (pluralForm || singular + 's') : singular}`
  }

  function formatSize(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
  }

  // minuscule, sans accents : pour la recherche
  function normalize(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  }

  // dates stockées à minuit UTC : affichage en UTC pour ne pas décaler d'un jour
  function formatDate(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  function flagUrl(iso2) {
    return iso2 ? `/resources/${String(iso2).toLowerCase()}.png` : ''
  }

  function countryStatus(country) {
    if (country?.visited) return 'visited'
    if (country?.toVisit) return 'toVisit'
    return 'none'
  }

  function setStatusBadge(el, status) {
    if (!el) return
    el.dataset.status = status
    el.textContent = STATUS_LABELS[status] || ''
  }

  // <img> masquée si pas de src ou si le fichier n'existe pas
  function setImage(img, src, alt = '') {
    if (!img) return
    if (!src) {
      img.hidden = true
      return
    }
    img.onerror = () => { img.hidden = true }
    img.alt = alt
    img.src = src
    img.hidden = false
  }

  // 1re photo d'un lieu (les vidéos sont ignorées)
  function firstPhoto(place) {
    return [...(place.media || [])]
      .filter((m) => m.mediaType !== 'VIDEO' && m.filePath)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] || null
  }

  // =============================
  // DÉMARRAGE
  // =============================
  const listView = document.querySelector('[data-view="list"]')
  const detailView = document.querySelector('[data-view="detail"]')
  const loadingEl = document.querySelector('[data-page-loading]')
  const pageError = document.querySelector('[data-page-error]')

  function showView(view) {
    loadingEl.hidden = true
    view.hidden = false
  }

  const countryId = new URLSearchParams(window.location.search).get('id')
  const run = countryId ? showDetail(countryId) : showList()

  run.catch((err) => {
    console.error(err)
    loadingEl.hidden = true
    showMessage(pageError, countryId ? 'Impossible de charger ce pays.' : 'Impossible de charger les pays.')
  })

  // =============================
  // LISTE
  // =============================
  async function showList() {
    const [countries, places] = await Promise.all([Api.listCountries(), Api.listPlaces()])

    const placesCount = new Map()
    for (const p of places) placesCount.set(p.countryId, (placesCount.get(p.countryId) || 0) + 1)

    const visited = countries
      .filter((c) => c.visited)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    setField(listView, 'summary', visited.length ? plural(visited.length, 'pays visité', 'pays visités') : '')

    const search = listView.querySelector('[data-search]')
    const emptyEl = listView.querySelector('[data-empty="countries"]')

    function render() {
      const q = normalize(search.value)
      const items = visited.filter((c) => !q || normalize(c.name).includes(q))

      emptyEl.textContent = visited.length
        ? 'Aucun pays ne correspond à ta recherche.'
        : 'Aucun pays visité pour l\'instant. Marque des pays comme visités depuis la carte.'

      fillList(listView, 'countries', 'country', items, (node, c) => {
        node.querySelector('[data-link]').href = `/country.html?id=${encodeURIComponent(c.id)}`
        setImage(node.querySelector('[data-flag]'), flagUrl(c.iso2))
        setField(node, 'name', c.name)

        const n = placesCount.get(c.id) || 0
        setField(node, 'meta', n ? plural(n, 'lieu', 'lieux') : 'Aucun lieu')
      })
    }

    search.hidden = visited.length === 0
    search.addEventListener('input', render)

    render()
    showView(listView)
  }

  // =============================
  // FICHE
  // =============================
  async function showDetail(id) {
    const [country, places] = await Promise.all([Api.getCountry(id), Api.listPlaces()])

    const own = places
      .filter((p) => p.countryId === country.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    document.title = `${country.name} · Travel Map`

    renderHero(country)
    renderCover(country.uiCoverImagePath)
    setupStatus(country)
    renderStats(own)
    renderPlaces(own)
    setupCoverEditor(country)

    showView(detailView)
  }

  // ---------- bandeau ----------
  function renderHero(country) {
    const iso3 = window.IsoCodes?.iso2ToIso3?.(country.iso2) || ''

    setField(detailView, 'name', country.name)
    setField(detailView, 'codes', [country.iso2, iso3].filter(Boolean).join(' · '))
    setImage(detailView.querySelector('[data-flag]'), flagUrl(country.iso2), `Drapeau ${country.name}`)
    setStatusBadge(detailView.querySelector('.country-hero [data-status]'), countryStatus(country))
  }

  // Couverture : l'image du pays, sinon le drapeau flouté en fond
  let currentFlag = ''

  function renderCover(src) {
    const img = detailView.querySelector('[data-cover]')
    const hero = detailView.querySelector('[data-hero]')
    const flag = detailView.querySelector('[data-flag]')?.getAttribute('src') || currentFlag
    currentFlag = flag

    function useFallback() {
      img.onerror = () => { img.hidden = true }
      img.classList.add('is-fallback')
      hero.classList.remove('has-cover')
      if (flag) {
        img.src = flag
        img.hidden = false
      } else {
        img.hidden = true
      }
    }

    if (!src) {
      useFallback()
      return
    }

    img.onerror = useFallback // image introuvable -> drapeau
    img.classList.remove('is-fallback')
    hero.classList.add('has-cover')
    img.src = src
    img.hidden = false
  }

  // ---------- statut (modifiable) ----------
  function setupStatus(country) {
    const fieldset = detailView.querySelector('[data-country-status]')
    const errorEl = detailView.querySelector('[data-country-status-error]')
    const savedEl = detailView.querySelector('[data-country-status-saved]')
    const badge = detailView.querySelector('.country-hero [data-status]')

    function render() {
      const status = countryStatus(country)
      const radio = fieldset.querySelector(`input[value="${status}"]`)
      if (radio) radio.checked = true
      setStatusBadge(badge, status)
    }

    fieldset.addEventListener('change', async (e) => {
      const input = e.target.closest('input[name="countryStatus"]')
      if (!input) return

      const data = { visited: input.value === 'visited', toVisit: input.value === 'toVisit' }

      fieldset.disabled = true
      showMessage(errorEl, null)
      showMessage(savedEl, null)

      try {
        await Api.updateCountry(country.id, data)
        Object.assign(country, data)
        showMessage(savedEl, 'Statut enregistré.')
      } catch (err) {
        console.error('Erreur changement statut pays:', err)
        showMessage(errorEl, "Impossible d'enregistrer le statut. Réessaie.")
      } finally {
        render() // remet l'ancien choix en cas d'erreur
        fieldset.disabled = false
      }
    })

    render()
  }

  // ---------- chiffres ----------
  function renderStats(own) {
    setField(detailView, 'placesCount', own.length)
    setField(detailView, 'visitedPlacesCount', own.filter((p) => p.visited).length)
    setField(detailView, 'photosCount', own.filter((p) => firstPhoto(p)).length)

    const byType = new Map()
    for (const p of own) byType.set(p.type, (byType.get(p.type) || 0) + 1)

    fillList(detailView, 'stats', 'stat', [...byType.entries()], (node, [type, count]) => {
      setField(node, 'label', TYPE_LABELS[type] || type)
      setField(node, 'count', count)
    })
  }

  // ---------- lieux en cartes ----------
  function renderPlaces(own) {
    fillList(detailView, 'places', 'place', own, (node, p) => {
      node.querySelector('[data-link]').href = `/place.html?id=${encodeURIComponent(p.id)}`

      const photo = firstPhoto(p)
      const img = node.querySelector('[data-photo]')
      const icon = node.querySelector('[data-icon]')
      icon.className = `bi ${TYPE_ICONS[p.type] || 'bi-geo-alt'}`

      if (photo) {
        img.onerror = () => { img.hidden = true; icon.hidden = false }
        img.alt = photo.caption || p.name
        img.src = photo.filePath
        img.hidden = false
        icon.hidden = true
      }

      setField(node, 'name', p.name)
      setField(node, 'meta', [
        TYPE_LABELS[p.type] || p.type,
        p.visitedAt ? formatDate(p.visitedAt) : null,
      ].filter(Boolean).join(' · '))

      setStatusBadge(node.querySelector('[data-status]'), p.visited ? 'visited' : 'toVisit')
    })
  }

  // ---------- couverture : changer / retirer ----------
  // POST   /api/countries/:id/cover  (champ "cover")  -> pays mis à jour
  // DELETE /api/countries/:id/cover                   -> pays mis à jour
  function setupCoverEditor(country) {
    const editBtn = detailView.querySelector('[data-cover-edit]')
    const editLabel = detailView.querySelector('[data-cover-edit-label]')
    const editor = detailView.querySelector('[data-cover-editor]')
    const input = editor.querySelector('[data-cover-input]')
    const filenameEl = editor.querySelector('[data-cover-filename]')
    const messageEl = editor.querySelector('[data-cover-message]')
    const progressEl = editor.querySelector('[data-cover-progress]')
    const saveBtn = editor.querySelector('[data-cover-save]')
    const cancelBtn = editor.querySelector('[data-cover-cancel]')
    const removeBtn = editor.querySelector('[data-cover-remove]')
    const previewTag = detailView.querySelector('[data-preview-tag]')
    const drop = editor.querySelector('.cover-drop')

    const defaultFilename = filenameEl.textContent
    let previewUrl = null   // URL locale de l'aperçu (à libérer)
    let pendingFile = null  // fichier choisi, pas encore envoyé
    let busy = false        // envoi ou suppression en cours

    // état des boutons selon : couverture existante ? fichier choisi ? envoi en cours ?
    function refreshControls() {
      const hasCover = !!country.uiCoverImagePath
      if (editLabel) editLabel.textContent = hasCover ? 'Changer la couverture' : 'Ajouter une couverture'

      removeBtn.hidden = !hasCover
      removeBtn.disabled = busy
      saveBtn.disabled = busy || !pendingFile
      cancelBtn.disabled = busy
      input.disabled = busy
      drop.classList.toggle('is-disabled', busy)
    }

    function setBusy(value) {
      busy = value
      refreshControls()
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

    // oublie le fichier choisi et réaffiche la vraie couverture
    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = null
      pendingFile = null
      input.value = ''
      filenameEl.textContent = defaultFilename
      previewTag.hidden = true
      setProgress(null)
      renderCover(country.uiCoverImagePath)
      refreshControls()
    }

    function open(isOpen) {
      editor.hidden = !isOpen
      editBtn.hidden = isOpen
      showMessage(messageEl, null)
      if (isOpen) editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }

    function preview(file) {
      if (!file || busy) return

      if (!COVER_TYPES.includes(file.type)) {
        showMessage(messageEl, 'Choisis une image JPG, PNG ou WebP.')
        return
      }
      if (file.size > COVER_MAX_BYTES) {
        showMessage(messageEl, `Image trop lourde (${formatSize(file.size)}) : 20 Mo maximum.`)
        return
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      previewUrl = URL.createObjectURL(file)
      pendingFile = file

      renderCover(previewUrl)
      filenameEl.textContent = file.name
      previewTag.hidden = false
      showMessage(messageEl, null)
      refreshControls()
    }

    editBtn.addEventListener('click', () => open(true))

    input.addEventListener('change', () => preview(input.files[0]))

    // glisser-déposer sur la zone
    drop.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (!busy) drop.classList.add('is-dragover')
    })
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'))
    drop.addEventListener('drop', (e) => {
      e.preventDefault()
      drop.classList.remove('is-dragover')
      preview(e.dataTransfer.files[0])
    })

    cancelBtn.addEventListener('click', () => {
      if (busy) return
      clearPreview()
      open(false)
    })

    // ---- envoi ----
    saveBtn.addEventListener('click', async () => {
      if (!pendingFile || busy) return

      setBusy(true)
      showMessage(messageEl, null)
      setProgress(0)

      try {
        const updated = await Api.uploadCountryCover(country.id, pendingFile, { onProgress: setProgress })
        country.uiCoverImagePath = updated?.uiCoverImagePath ?? null
        clearPreview() // affiche la couverture enregistrée
        open(false)
      } catch (err) {
        console.error('Erreur envoi couverture:', err)
        setProgress(null)
        showMessage(messageEl, apiErrorMessage(err, "Impossible d'enregistrer la couverture. Réessaie."))
      } finally {
        setBusy(false)
      }
    })

    // ---- retrait ----
    removeBtn.addEventListener('click', async () => {
      if (busy || !country.uiCoverImagePath) return
      if (!window.confirm("Retirer la couverture de ce pays ? L'image sera supprimée.")) return

      setBusy(true)
      showMessage(messageEl, null)

      try {
        const updated = await Api.deleteCountryCover(country.id)
        country.uiCoverImagePath = updated?.uiCoverImagePath ?? null
        clearPreview() // retour au drapeau flouté
        open(false)
      } catch (err) {
        console.error('Erreur retrait couverture:', err)
        showMessage(messageEl, apiErrorMessage(err, 'Impossible de retirer la couverture. Réessaie.'))
      } finally {
        setBusy(false)
      }
    })

    refreshControls()
  }
})()