// public/js/vlogs.js
// /vlogs.html          -> liste des vlogs (du plus récent au plus ancien)
// /vlogs.html?id=...   -> lecteur + infos modifiables + pays liés + suppression
//
// Dépend de : window.Api (api.js)
// Vlog : title, urlOrPath, date, description (obligatoire en base -> '' si vide)
// Pays liés : lus dans vlog.countryVlogs, enregistrés avec
//             Api.setVlogCountries(id, countryIds) -> PUT /vlogs/:id/countries { countryIds }

(function () {
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

  function plural(count, singular, pluralForm) {
    return `${count} ${count > 1 ? (pluralForm || singular + 's') : singular}`
  }

  function toDateInputValue(value) {
    return value ? String(value).slice(0, 10) : ''
  }

  // dates stockées à minuit UTC : affichage en UTC pour ne pas décaler d'un jour
  function formatDate(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }

  function flagUrl(iso2) {
    return iso2 ? `/resources/${String(iso2).toLowerCase()}.png` : ''
  }

  // ids des pays liés : vlog.countryVlogs = [{ countryId, country? }]
  function vlogCountryIds(vlog) {
    return (vlog?.countryVlogs || []).map((cv) => cv.countryId ?? cv.country?.id).filter(Boolean)
  }

  // =============================
  // SOURCE VIDÉO
  // =============================
  // Renvoie { kind: 'youtube' | 'vimeo' | 'file' | 'link', embed?, thumb? }
  function parseSource(urlOrPath) {
    const value = String(urlOrPath || '').trim()
    if (!value) return { kind: 'link' }

    let url = null
    try { url = new URL(value) } catch { /* chemin local */ }

    if (url) {
      const host = url.hostname.replace(/^www\.|^m\./, '')
      let ytId = null
      if (host === 'youtu.be') ytId = url.pathname.slice(1).split('/')[0]
      if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        ytId = url.searchParams.get('v')
        const parts = url.pathname.split('/')
        if (!ytId && ['embed', 'shorts', 'live'].includes(parts[1])) ytId = parts[2]
      }
      if (ytId) {
        const id = encodeURIComponent(ytId)
        return {
          kind: 'youtube',
          embed: `https://www.youtube-nocookie.com/embed/${id}`,
          thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        }
      }

      if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const vimeoId = url.pathname.split('/').find((part) => /^\d+$/.test(part))
        if (vimeoId) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${vimeoId}` }
      }
    }

    if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(value)) return { kind: 'file' }
    return { kind: 'link' }
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

  const vlogId = new URLSearchParams(window.location.search).get('id')
  const run = vlogId ? showDetail(vlogId) : showList()

  run.catch((err) => {
    console.error(err)
    loadingEl.hidden = true
    showMessage(pageError, vlogId ? 'Impossible de charger ce vlog.' : 'Impossible de charger les vlogs.')
  })

  // =============================
  // LISTE
  // =============================
  async function showList() {
    const [vlogs, countries] = await Promise.all([
      Api.listVlogs(),
      Api.listCountries().catch(() => []),
    ])
    const countriesById = new Map(countries.map((c) => [c.id, c]))

    vlogs.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    setField(listView, 'summary', vlogs.length ? plural(vlogs.length, 'vlog') : '')

    fillList(listView, 'vlogs', 'vlog', vlogs, (node, v) => {
      node.querySelector('[data-link]').href = `/vlogs.html?id=${encodeURIComponent(v.id)}`
      setField(node, 'title', v.title)

      const names = vlogCountryIds(v).map((id) => countriesById.get(id)?.name).filter(Boolean)
      setField(node, 'meta', [formatDate(v.date), names.join(', ')].filter(Boolean).join(' · '))

      // vignette : miniature YouTube, 1re image d'une vidéo locale, sinon icône
      const source = parseSource(v.urlOrPath)
      const img = node.querySelector('[data-thumb]')
      const video = node.querySelector('[data-thumb-video]')

      if (source.thumb) {
        img.src = source.thumb
        img.onerror = () => { img.hidden = true }
        img.hidden = false
      } else if (source.kind === 'file') {
        video.src = `${v.urlOrPath}#t=1`
        video.hidden = false
      }
    })

    showView(listView)
  }

  // =============================
  // VLOG
  // =============================
  async function showDetail(id) {
    const [vlogInitial, countries] = await Promise.all([
      Api.getVlog(id),
      Api.listCountries().catch(() => []),
    ])

    let vlog = vlogInitial
    let linkedIds = vlogCountryIds(vlog)
    const countriesById = new Map(countries.map((c) => [c.id, c]))

    const form = detailView.querySelector('[data-vlog-form]')
    const errorEl = form.querySelector('[data-vlog-error]')
    const savedEl = form.querySelector('[data-vlog-saved]')

    // ---------- lecteur ----------
    let renderedSource = null

    function renderPlayer() {
      // on ne recharge pas le lecteur si la vidéo n'a pas changé
      if (renderedSource === vlog.urlOrPath) return
      renderedSource = vlog.urlOrPath

      const source = parseSource(vlog.urlOrPath)
      const embed = detailView.querySelector('[data-player-embed]')
      const video = detailView.querySelector('[data-player-video]')
      const fallback = detailView.querySelector('[data-player-fallback]')
      const openLink = detailView.querySelector('[data-player-open]')

      embed.hidden = true
      video.hidden = true
      fallback.hidden = true
      embed.removeAttribute('src')
      video.pause()
      video.removeAttribute('src')

      if (source.embed) {
        embed.src = source.embed
        embed.hidden = false
      } else if (source.kind === 'file') {
        video.src = vlog.urlOrPath
        video.hidden = false
        video.onerror = () => {
          video.hidden = true
          fallback.hidden = false
        }
      } else {
        fallback.hidden = false
      }

      if (vlog.urlOrPath) openLink.href = vlog.urlOrPath
      else openLink.removeAttribute('href')
      openLink.hidden = !vlog.urlOrPath

      const sourceLink = detailView.querySelector('[data-source-link]')
      sourceLink.href = vlog.urlOrPath || '#'
      sourceLink.hidden = !vlog.urlOrPath
      setField(detailView, 'source', vlog.urlOrPath || '')
    }

    // ---------- en-tête + pays liés ----------
    function renderInfo() {
      document.title = `${vlog.title} · Travel Map`
      setField(detailView, 'title', vlog.title)

      const linked = linkedIds
        .map((cid) => countriesById.get(cid))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

      setField(detailView, 'subtitle', [formatDate(vlog.date), linked.map((c) => c.name).join(', ')]
        .filter(Boolean).join(' · '))

      fillList(detailView, 'countries', 'country', linked, (node, c) => {
        node.querySelector('[data-link]').href = `/country.html?id=${encodeURIComponent(c.id)}`
        const flag = node.querySelector('[data-flag]')
        flag.src = flagUrl(c.iso2)
        flag.onerror = () => { flag.hidden = true }
        setField(node, 'name', c.name)
      })
    }

    // ---------- formulaire ----------
    // pays proposés : visités / à visiter + ceux déjà liés
    function renderCountryChips() {
      const box = form.querySelector('[data-country-chips]')
      const selected = new Set(linkedIds)

      const options = countries
        .filter((c) => c.visited || c.toVisit || selected.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

      box.replaceChildren(...options.map((c) => {
        const label = document.createElement('label')
        label.className = 'country-chip'

        const input = document.createElement('input')
        input.type = 'checkbox'
        input.name = 'countries'
        input.value = c.id
        input.checked = selected.has(c.id)

        const flag = document.createElement('img')
        flag.src = flagUrl(c.iso2)
        flag.alt = ''
        flag.onerror = () => { flag.hidden = true }

        const name = document.createElement('span')
        name.textContent = c.name

        label.append(input, flag, name)
        return label
      }))

      form.querySelector('[data-country-hint]').textContent = options.length
        ? 'Seuls tes pays visités ou à visiter sont proposés.'
        : 'Marque des pays comme visités ou à visiter pour pouvoir les lier.'
    }

    function renderForm() {
      formField(form, 'title').value = vlog.title || ''
      formField(form, 'urlOrPath').value = vlog.urlOrPath || ''
      formField(form, 'date').value = toDateInputValue(vlog.date)
      formField(form, 'description').value = vlog.description || ''
      renderCountryChips()
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      showMessage(errorEl, null)
      showMessage(savedEl, null)

      const fd = new FormData(form)
      const title = String(fd.get('title') || '').trim()
      const urlOrPath = String(fd.get('urlOrPath') || '').trim()
      const date = fd.get('date') || ''
      const countryIds = fd.getAll('countries').map(String)

      if (!title) return showMessage(errorEl, 'Le titre est obligatoire.')
      if (!urlOrPath) return showMessage(errorEl, 'Le lien de la vidéo est obligatoire.')
      if (!date) return showMessage(errorEl, 'La date est obligatoire.')

      setFormBusy(form, true)

      // 1) infos du vlog
      try {
        const updated = await Api.updateVlog(vlog.id, {
          title,
          urlOrPath,
          date,
          description: String(fd.get('description') || '').trim(),
        })
        vlog = { ...vlog, ...updated }
      } catch (err) {
        console.error('Erreur modification vlog:', err)
        setFormBusy(form, false)
        showMessage(errorEl, "Impossible d'enregistrer les modifications. Réessaie.")
        return
      }

      // 2) pays liés (seulement s'ils ont changé)
      const changed = countryIds.length !== linkedIds.length || countryIds.some((cid) => !linkedIds.includes(cid))
      let countriesError = false
      if (changed) {
        try {
          await Api.setVlogCountries(vlog.id, countryIds)
          linkedIds = countryIds
        } catch (err) {
          console.error('Erreur pays du vlog:', err)
          countriesError = true
        }
      }

      setFormBusy(form, false)
      renderInfo()
      renderPlayer()
      renderForm()

      if (countriesError) {
        showMessage(errorEl, "Infos enregistrées, mais pas les pays. Réessaie.")
      } else {
        showMessage(savedEl, 'Modifications enregistrées.')
      }
    })

    // ---------- suppression ----------
    const deleteBtn = detailView.querySelector('[data-delete]')
    const confirmBox = detailView.querySelector('[data-delete-confirm]')
    const deleteError = detailView.querySelector('[data-delete-error]')
    const yesBtn = confirmBox.querySelector('[data-delete-yes]')

    deleteBtn.addEventListener('click', () => {
      confirmBox.hidden = false
      deleteBtn.hidden = true
      showMessage(deleteError, null)
      yesBtn.focus()
    })

    confirmBox.querySelector('[data-delete-no]').addEventListener('click', () => {
      confirmBox.hidden = true
      deleteBtn.hidden = false
    })

    yesBtn.addEventListener('click', async () => {
      confirmBox.querySelectorAll('button').forEach((b) => { b.disabled = true })
      try {
        await Api.deleteVlog(vlog.id)
        window.location.href = '/vlogs.html'
      } catch (err) {
        console.error('Erreur suppression vlog:', err)
        confirmBox.querySelectorAll('button').forEach((b) => { b.disabled = false })
        confirmBox.hidden = true
        deleteBtn.hidden = false
        showMessage(deleteError, 'Impossible de supprimer ce vlog. Réessaie.')
      }
    })

    renderPlayer()
    renderInfo()
    renderForm()
    showView(detailView)
  }
})()