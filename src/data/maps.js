export function createStreetViewUrl (lat, lng, apiKey, fov = 90) {
  return `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${lat},${lng}&fov=${fov}`
}

export function createGoogleMapsUrl (lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
