// public/js/api.js
(function () {
  const API_BASE = '/api'

  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }

    if (res.status === 204) return null
    return res.json()
  }

  // -------- Countries --------
  function listCountries() {
    return request('/countries')
  }

  function createCountry(data) {
    return request('/countries', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  function updateCountry(id, data) {
  return request(`/countries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

  // -------- Places --------
  function listPlaces() {
    return request('/places')
  }

  function createPlace(data) {
    return request('/places', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  window.Api = {
    listCountries,
    createCountry,
    listPlaces,
    createPlace,
    updateCountry,
  }
})()