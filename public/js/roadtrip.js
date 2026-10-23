// public/js/roadtrip.js
// /roadtrip.html          -> liste des roadtrips par nom
// /roadtrip.html?id=...   -> étapes dans l'ordre, avec dates et photos défilantes
//
// Dépend de : window.Api (api.js)
// Retirer une étape : DELETE /api/trips/stops/:id -> supprime le TripStop seulement,
//                     le lieu (Place) est conservé. Minimum 2 étapes par roadtrip.
// Dates : TripStop n'a pas de date -> dates du roadtrip en haut,
//         date de visite du lieu (Place.visitedAt) sur chaque étape.

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

  // un roadtrip a besoin d'au moins 2 étapes pour avoir un tracé
  const MIN_STOPS = 2

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
  // fillItem(node, item, index) peut renvoyer une fonction à appeler une fois le node dans la page
  function fillList(root, listName, itemName, items, fillItem) {
    const list = root.querySelector(`[data-list="${listName}"]`)
    const itemTpl = root.querySelector(`template[data-item="${itemName}"]`)
    const empty = root.querySelector(`[data-empty="${listName}"]`)
    if (!list || !itemTpl) return

    list.replaceChildren()
    const afterInsert = []
    items.forEach((item, i) => {
      const node = itemTpl.content.firstElementChild.cloneNode(true)
      const after = fillItem(node, item, i)
      list.append(node)
      if (typeof after === 'function') afterInsert.push(after)
    })
    afterInsert.forEach((fn) => fn())

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

  function plural(count, singular, pluralForm) {
    return `${count} ${count > 1 ? (pluralForm || singular + 's') : singular}`
  }

  // dates stockées à minuit UTC : affichage en UTC pour ne pas décaler d'un jour
  function formatDate(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }

  function formatDateRange(start, end) {
    const s = formatDate(start)
    const e = formatDate(end)
    if (s && e) return s === e ? s : `du ${s} au ${e}`
    if (s) return `à partir du ${s}`
    if (e) return `jusqu'au ${e}`
    return ''
  }

  function photosOf(place) {
    return [...(place?.media || [])]
      .filter((m) => m.mediaType !== 'VIDEO' && m.filePath)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
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

  const tripId = new URLSearchParams(window.location.search).get('id')
  const run = tripId ? showDetail(tripId) : showList()

  run.catch((err) => {
    console.error(err)
    loadingEl.hidden = true
    showMessage(pageError, tripId ? 'Impossible de charger ce roadtrip.' : 'Impossible de charger les roadtrips.')
  })

  // =============================
  // LISTE
  // =============================
  async function showList() {
    const trips = (await Api.listTrips())
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    setField(listView, 'summary', trips.length ? plural(trips.length, 'roadtrip') : '')

    fillList(listView, 'trips', 'trip', trips, (node, trip) => {
      node.querySelector('[data-link]').href = `/roadtrip.html?id=${encodeURIComponent(trip.id)}`
      setField(node, 'name', trip.name)
      setField(node, 'meta', [
        plural((trip.stops || []).length, 'étape'),
        formatDateRange(trip.startDate, trip.endDate),
      ].filter(Boolean).join(' · '))
    })

    showView(listView)
  }

  // =============================
  // DÉTAIL
  // =============================
  async function showDetail(id) {
    // les photos ne sont pas dans le trip : on les prend dans la liste des lieux
    const [trip, places] = await Promise.all([Api.getTrip(id), Api.listPlaces()])
    const placesById = new Map(places.map((p) => [p.id, p]))

    document.title = `${trip.name} · Travel Map`

    // ---------- en-tête ----------
    const stops = [...(trip.stops || [])].sort((a, b) => a.orderIndex - b.orderIndex)
    const dates = formatDateRange(trip.startDate, trip.endDate)

    setField(detailView, 'name', trip.name)
    setField(detailView, 'dates', dates)
    detailView.querySelector('[data-dates]').hidden = !dates
    setField(detailView, 'stepCount', plural(stops.length, 'étape'))
    setField(detailView, 'description', trip.description || '')
    detailView.querySelector('.trip-head-description').hidden = !trip.description

    // ---------- étapes ----------
    fillList(detailView, 'stops', 'stop', stops, (node, stop, i) => {
      const place = stop.placeId ? placesById.get(stop.placeId) : null
      const title = place?.name || stop.title || `Étape ${i + 1}`

      node.dataset.stopId = stop.id
      setField(node, 'index', i + 1)
      setField(node, 'title', title)

      // date de visite du lieu
      const date = formatDate(place?.visitedAt)
      setField(node, 'date', date)
      node.querySelector('[data-stop-date]').hidden = !date

      // type + pays, ou "point libre"
      setField(node, 'details', place
        ? [TYPE_LABELS[place.type] || place.type, place.country?.name].filter(Boolean).join(' · ')
        : 'Point libre')

      setField(node, 'description', place?.description || '')
      node.querySelector('.stop-description').hidden = !place?.description

      const link = node.querySelector('[data-place-link]')
      if (place) link.href = `/place.html?id=${encodeURIComponent(place.id)}`
      else link.hidden = true

      // le carrousel a besoin de la largeur réelle : on l'initialise une fois dans la page
      return () => setupCarousel(node.querySelector('[data-carousel]'), photosOf(place), title)
    })

    setupStopRemoval()
    showView(detailView)
  }

  // =============================
  // RETIRER UNE ÉTAPE
  // =============================
  // Le TripStop est supprimé, le lieu reste. Le serveur renumérote les étapes
  // suivantes ; ici on retire la carte de l'étape et on renumérote l'affichage
  // (les carrousels des autres étapes ne sont pas reconstruits).
  function setupStopRemoval() {
    const list = detailView.querySelector('[data-list="stops"]')
    const hint = detailView.querySelector('[data-stops-hint]')

    function closeConfirms(except) {
      list.querySelectorAll('[data-stop-confirm]').forEach((box) => {
        if (box !== except) box.hidden = true
      })
    }

    // numéros, compteur, et blocage sous le minimum d'étapes
    function refresh() {
      const items = [...list.children]
      const canRemove = items.length > MIN_STOPS

      items.forEach((li, i) => {
        setField(li, 'index', i + 1)
        const btn = li.querySelector('[data-stop-remove]')
        btn.disabled = !canRemove
        btn.title = canRemove ? '' : `Un roadtrip garde au moins ${MIN_STOPS} étapes`
      })

      setField(detailView, 'stepCount', plural(items.length, 'étape'))
      if (hint) hint.hidden = canRemove || items.length === 0
    }

    function setBusy(li, busy) {
      li.classList.toggle('is-busy', busy)
      li.querySelectorAll('[data-stop-confirm] button').forEach((b) => { b.disabled = busy })
    }

    list.addEventListener('click', async (e) => {
      const li = e.target.closest('.stop')
      if (!li || li.classList.contains('is-busy')) return

      const confirmBox = li.querySelector('[data-stop-confirm]')
      const errorEl = li.querySelector('[data-stop-error]')

      // demander confirmation
      if (e.target.closest('[data-stop-remove]')) {
        closeConfirms(confirmBox)
        showMessage(errorEl, null)
        confirmBox.hidden = !confirmBox.hidden
        return
      }

      if (e.target.closest('[data-stop-confirm-no]')) {
        confirmBox.hidden = true
        return
      }

      // confirmer
      if (e.target.closest('[data-stop-confirm-yes]')) {
        setBusy(li, true)
        showMessage(errorEl, null)

        try {
          await Api.deleteTripStop(li.dataset.stopId)
          li.remove()
          refresh()
        } catch (err) {
          console.error('Erreur retrait étape:', err)
          setBusy(li, false)
          confirmBox.hidden = true
          showMessage(errorEl, apiErrorMessage(err, "Impossible de retirer cette étape. Réessaie."))
        }
      }
    })

    // Échap ferme les confirmations ouvertes
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeConfirms(null)
    })

    refresh()
  }

  // =============================
  // CARROUSEL DE PHOTOS
  // =============================
  // Défilement : boutons ‹ ›, points, flèches du clavier (quand il a le focus),
  // glisser au doigt / trackpad (scroll-snap natif).
  function setupCarousel(carousel, photos, title) {
    const track = carousel.querySelector('[data-track]')
    const prev = carousel.querySelector('[data-prev]')
    const next = carousel.querySelector('[data-next]')
    const counter = carousel.querySelector('[data-counter]')
    const dots = carousel.querySelector('[data-dots]')
    const empty = carousel.querySelector('[data-carousel-empty]')

    // --- aucune photo ---
    if (!photos.length) {
      carousel.classList.add('is-empty')
      empty.hidden = false
      track.hidden = true
      prev.hidden = true
      next.hidden = true
      counter.hidden = true
      dots.hidden = true
      return
    }

    track.setAttribute('aria-label', `Photos de ${title}`)

    // --- slides + points ---
    photos.forEach((m, i) => {
      const slide = document.createElement('figure')
      slide.className = 'carousel-slide'

      const img = document.createElement('img')
      img.src = m.filePath
      img.alt = m.caption || `${title} – photo ${i + 1}`
      img.loading = i === 0 ? 'eager' : 'lazy'
      img.draggable = false
      img.onerror = () => slide.classList.add('is-broken')
      slide.append(img)

      if (m.caption) {
        const caption = document.createElement('figcaption')
        caption.textContent = m.caption
        slide.append(caption)
      }

      track.append(slide)

      const dot = document.createElement('button')
      dot.type = 'button'
      dot.className = 'carousel-dot'
      dot.setAttribute('aria-label', `Photo ${i + 1}`)
      dot.addEventListener('click', () => goTo(i))
      dots.append(dot)
    })

    // une seule photo : pas de navigation
    const single = photos.length === 1
    prev.hidden = single
    next.hidden = single
    dots.hidden = single
    counter.hidden = single

    // --- position ---
    let index = 0

    function update() {
      counter.textContent = `${index + 1} / ${photos.length}`
      prev.disabled = index === 0
      next.disabled = index === photos.length - 1
      dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
        if (i === index) d.setAttribute('aria-current', 'true')
        else d.removeAttribute('aria-current')
      })
    }

    function goTo(i) {
      index = Math.max(0, Math.min(photos.length - 1, i))
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
      update()
    }

    prev.addEventListener('click', () => goTo(index - 1))
    next.addEventListener('click', () => goTo(index + 1))

    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1) }
    })

    // glisser au doigt / trackpad : on suit la position réelle du défilement
    let frame = 0
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
        if (i !== index) {
          index = i
          update()
        }
      })
    })

    // redimensionnement : rester sur la même photo
    window.addEventListener('resize', () => {
      track.scrollTo({ left: index * track.clientWidth })
    })

    update()
  }
})()