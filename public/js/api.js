// public/js/api.js
(function () {
  const API_BASE = '/api'

  // -------- Requêtes JSON --------
  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }

    if (res.status === 204) return null
    return res.json()
  }

  const get = (path) => request(path)
  const post = (path, data) => request(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined })
  const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) })
  const patch = (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) })
  const del = (path) => request(path, { method: 'DELETE' })

  // -------- Envoi de fichiers (multipart/form-data) --------
  // Pas de Content-Type : le navigateur l'écrit lui-même pour un FormData.
  // XMLHttpRequest plutôt que fetch pour suivre la progression de l'envoi.
  // onProgress(fraction) reçoit une valeur entre 0 et 1.
  // En cas d'erreur : Error(texte de la réponse), comme request().
  function upload(path, formData, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}${path}`)
      xhr.responseType = 'text'

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total)
        })
      }

      xhr.addEventListener('load', () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
          return
        }
        if (xhr.status === 204 || !xhr.responseText) return resolve(null)
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Réponse illisible du serveur.'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Envoi impossible (serveur injoignable).')))
      xhr.addEventListener('abort', () => reject(new Error('Envoi annulé.')))

      xhr.send(formData)
    })
  }

  // -------- Countries --------
  const listCountries = () => get('/countries')
  const getCountry = (id) => get(`/countries/${id}`)
  const createCountry = (data) => post('/countries', data)
  const updateCountry = (id, data) => patch(`/countries/${id}`, data)
  const deleteCountry = (id) => del(`/countries/${id}`)

  // couverture : une image (File) dans le champ "cover"
  function uploadCountryCover(countryId, file, options) {
    const formData = new FormData()
    formData.append('cover', file)
    return upload(`/countries/${countryId}/cover`, formData, options)
  }
  const deleteCountryCover = (countryId) => del(`/countries/${countryId}/cover`)

  // -------- Places --------
  const listPlaces = () => get('/places')
  const getPlace = (id) => get(`/places/${id}`)
  const createPlace = (data) => post('/places', data)
  const updatePlace = (id, data) => patch(`/places/${id}`, data)
  const deletePlace = (id) => del(`/places/${id}`)

  // -------- Trips --------
  const listTrips = () => get('/trips')
  const getTrip = (id) => get(`/trips/${id}`)
  const createTrip = (data) => post('/trips', data)
  const updateTrip = (id, data) => patch(`/trips/${id}`, data)
  const deleteTrip = (id) => del(`/trips/${id}`)

  // -------- Trip stops --------
  const addTripStop = (tripId, data) => post(`/trips/${tripId}/stops`, data)
  const updateTripStop = (stopId, data) => patch(`/trips/stops/${stopId}`, data)
  const deleteTripStop = (stopId) => del(`/trips/stops/${stopId}`)

  // -------- Vlogs --------
  const listVlogs = () => get('/vlogs')
  const getVlog = (id) => get(`/vlogs/${id}`)
  const createVlog = (data) => post('/vlogs', data)
  const updateVlog = (id, data) => patch(`/vlogs/${id}`, data)
  const deleteVlog = (id) => del(`/vlogs/${id}`)
  const linkVlogToCountry = (vlogId, countryId) => post(`/vlogs/${vlogId}/countries/${countryId}`)
  const unlinkVlogFromCountry = (vlogId, countryId) => del(`/vlogs/${vlogId}/countries/${countryId}`)
  const setVlogCountries = (vlogId, countryIds) => put(`/vlogs/${vlogId}/countries`, { countryIds })

  // -------- Media --------
  const listMedia = (placeId) => get(placeId ? `/media?placeId=${encodeURIComponent(placeId)}` : '/media')
  const getMedia = (id) => get(`/media/${id}`)
  const createMedia = (data) => post('/media', data)
  const updateMedia = (id, data) => patch(`/media/${id}`, data)
  const deleteMedia = (id) => del(`/media/${id}`) // supprime aussi le fichier

  // photos / vidéos d'un lieu : plusieurs fichiers (File) dans le champ "files"
  // renvoie la liste des médias créés
  function uploadPlaceMedia(placeId, files, options) {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)
    return upload(`/places/${placeId}/media`, formData, options)
  }

  // -------- Géocodage --------
  function searchPlaces(q, { limit, country } = {}) {
    const params = new URLSearchParams({ q })
    if (limit) params.set('limit', limit)
    if (country) params.set('country', country)
    return get(`/geocode/search?${params}`)
  }

  // -------- Backup --------
  const importBackup = (data) => post('/backup/import', data)

  window.Api = {
    listCountries, getCountry, createCountry, updateCountry, deleteCountry,
    uploadCountryCover, deleteCountryCover,
    listPlaces, getPlace, createPlace, updatePlace, deletePlace,
    listTrips, getTrip, createTrip, updateTrip, deleteTrip,
    addTripStop, updateTripStop, deleteTripStop,
    listVlogs, getVlog, createVlog, updateVlog, deleteVlog,
    linkVlogToCountry, unlinkVlogFromCountry, setVlogCountries,
    listMedia, getMedia, createMedia, updateMedia, deleteMedia,
    uploadPlaceMedia,
    importBackup, searchPlaces,
  }
})()