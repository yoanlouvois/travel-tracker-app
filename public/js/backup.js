// public/js/backup.js
// Section "Données" de la sidebar (index.html) : export / import de la base en JSON.
//
// Export : GET  /api/backup/export -> téléchargement de travel-map-AAAA-MM-JJ.json
// Import : choix du fichier -> aperçu de son contenu -> confirmation
//          -> POST /api/backup/import (Api.importBackup) -> rapport
//          -> rechargement des données de la carte
//
// Dépend de : window.Api (api.js)
// Utilise si présents : window.PlacesApi, window.RoadtripsApi, window.CountriesApi, window.InfoPanel

(function () {
  const root = document.querySelector('[data-backup]')
  if (!root) return

  const FORMAT_VERSION = 1

  const importBtn = root.querySelector('[data-backup-import]')
  const exportBtn = root.querySelector('[data-backup-export]')
  const fileInput = root.querySelector('[data-backup-file]')
  const preview = root.querySelector('[data-backup-preview]')
  const previewName = root.querySelector('[data-backup-filename]')
  const previewList = root.querySelector('[data-backup-preview-list]')
  const confirmBtn = root.querySelector('[data-backup-confirm]')
  const cancelBtn = root.querySelector('[data-backup-cancel]')
  const messageEl = root.querySelector('[data-backup-message]')
  const reportEl = root.querySelector('[data-backup-report]')

  let pendingData = null // contenu du fichier en attente de confirmation

  // =============================
  // AFFICHAGE
  // =============================
  // type : 'info' | 'success' | 'error' | null (masquer)
  function showMessage(text, type = 'info') {
    messageEl.textContent = text || ''
    messageEl.dataset.type = type || ''
    messageEl.hidden = !text
  }

  // lignes : [[libellé, texte], ...]
  function fillReport(list, lines) {
    list.replaceChildren(...lines.map(([label, text]) => {
      const li = document.createElement('li')
      const strong = document.createElement('strong')
      strong.textContent = label
      const span = document.createElement('span')
      span.textContent = text
      li.append(strong, span)
      return li
    }))
    list.hidden = lines.length === 0
  }

  function setBusy(busy) {
    root.querySelectorAll('button').forEach((b) => { b.disabled = busy })
    root.classList.toggle('is-busy', busy)
  }

  function plural(count, singular, pluralForm) {
    return `${count} ${count > 1 ? (pluralForm || singular + 's') : singular}`
  }

  // l'API renvoie { error: "..." } dans le message d'erreur (voir api.js -> request)
  function errorText(err, fallback) {
    try {
      const body = JSON.parse(err.message)
      if (body && body.error) return body.error
    } catch {
      // pas du JSON
    }
    return err?.message && !err.message.startsWith('<') ? err.message : fallback
  }

  function resetPreview() {
    pendingData = null
    preview.hidden = true
    fileInput.value = '' // permet de re-choisir le même fichier
  }

  // =============================
  // EXPORT
  // =============================
  async function exportBackup() {
    resetPreview()
    fillReport(reportEl, [])
    showMessage('Préparation de l\'export…')
    setBusy(true)

    try {
      const res = await fetch('/api/backup/export')
      if (!res.ok) throw new Error(await res.text())

      // nom de fichier proposé par le serveur, sinon un nom par défaut
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `travel-map-${new Date().toISOString().slice(0, 10)}.json`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      showMessage(`Export téléchargé : ${filename}`, 'success')
    } catch (err) {
      console.error('Erreur export:', err)
      showMessage(errorText(err, "Impossible d'exporter les données."), 'error')
    } finally {
      setBusy(false)
    }
  }

  // =============================
  // IMPORT : 1) lecture + aperçu
  // =============================
  async function readFile(file) {
    resetPreview()
    fillReport(reportEl, [])
    showMessage(null)
    if (!file) return

    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      showMessage(`« ${file.name} » n'est pas un fichier JSON valide.`, 'error')
      return
    }

    // vérifications rapides (le serveur fait la validation complète)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      showMessage('Ce fichier ne ressemble pas à une sauvegarde Travel Map.', 'error')
      return
    }
    if (data.version !== FORMAT_VERSION) {
      showMessage(`Version de sauvegarde non prise en charge (${data.version ?? 'absente'}).`, 'error')
      return
    }

    const count = (key) => (Array.isArray(data[key]) ? data[key].length : 0)
    const mediaCount = (data.places || []).reduce((n, p) => n + (Array.isArray(p?.media) ? p.media.length : 0), 0)

    previewName.textContent = file.name
    const exported = data.exportedAt ? new Date(data.exportedAt) : null

    fillReport(previewList, [
      ...(exported && !Number.isNaN(exported.getTime())
        ? [['Exporté le', exported.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })]]
        : []),
      ['Pays', plural(count('countries'), 'renseigné')],
      ['Lieux', String(count('places'))],
      ['Photos', String(mediaCount)],
      ['Roadtrips', String(count('trips'))],
      ['Vlogs', String(count('vlogs'))],
    ])

    pendingData = data
    preview.hidden = false
    confirmBtn.focus()
  }

  // =============================
  // IMPORT : 2) envoi + rapport
  // =============================
  async function importBackup() {
    if (!pendingData) return

    showMessage('Import en cours…')
    setBusy(true)

    try {
      const report = await Api.importBackup(pendingData)
      resetPreview()

      const r = (key) => report?.[key] || {}
      const lines = [
        ['Pays', `${plural(r('countries').updated || 0, 'mis à jour', 'mis à jour')}, ${r('countries').unchanged || 0} inchangés`],
        ['Lieux', `${plural(r('places').added || 0, 'ajouté')}, ${r('places').skipped || 0} déjà présents`],
        ['Photos', `${plural(r('media').added || 0, 'ajoutée')}, ${r('media').skipped || 0} déjà présentes`],
        ['Roadtrips', `${plural(r('trips').added || 0, 'ajouté')}, ${r('trips').skipped || 0} déjà présents`],
        ['Vlogs', `${plural(r('vlogs').added || 0, 'ajouté')}, ${r('vlogs').skipped || 0} déjà présents`],
      ]

      const changed = ['places', 'media', 'trips', 'vlogs'].some((k) => r(k).added > 0) || r('countries').updated > 0

      fillReport(reportEl, lines)
      showMessage(changed ? 'Import terminé.' : 'Import terminé : tout était déjà présent.', 'success')

      if (changed) await reloadMap()
    } catch (err) {
      console.error('Erreur import:', err)
      // tout ou rien côté serveur : rien n'a été importé
      showMessage(`${errorText(err, "Impossible d'importer ce fichier.")} Rien n'a été importé.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  // Recharge les données de la carte sans recharger la page
  async function reloadMap() {
    window.InfoPanel?.close?.() // son contenu peut ne plus être à jour

    try {
      // les roadtrips s'appuient sur les lieux : d'abord les lieux
      await window.PlacesApi?.reload?.()
      await Promise.all([
        window.RoadtripsApi?.reload?.(),
        window.CountriesApi?.reload?.(),
      ])
    } catch (err) {
      console.error('Erreur rechargement de la carte:', err)
      showMessage('Import terminé. Recharge la page pour voir les nouvelles données.', 'info')
    }
  }

  // =============================
  // ÉVÉNEMENTS
  // =============================
  importBtn.addEventListener('click', () => fileInput.click())
  exportBtn.addEventListener('click', exportBackup)
  fileInput.addEventListener('change', () => readFile(fileInput.files[0]))
  confirmBtn.addEventListener('click', importBackup)

  cancelBtn.addEventListener('click', () => {
    resetPreview()
    showMessage(null)
  })

  // glisser un fichier .json sur la section
  root.addEventListener('dragover', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return
    e.preventDefault()
    root.classList.add('is-dragover')
  })
  root.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget)) root.classList.remove('is-dragover')
  })
  root.addEventListener('drop', (e) => {
    e.preventDefault()
    root.classList.remove('is-dragover')
    readFile(e.dataTransfer.files[0])
  })
})()