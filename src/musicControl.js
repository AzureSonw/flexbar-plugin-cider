const API_BASE = "http://127.0.0.1:10767/api/v1"
let ciderToken = ""
let cachedArtwork = { url: "", data: "" }

export function setCiderToken(value) {
  ciderToken = typeof value === "string" ? value : ""
}

async function request(endpoint, method, token, body) {
  if (!token) return null
  try {
    return await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { apptoken: token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    return null
  }
}

export async function testConnection(token) {
  const response = await request("/playback/active", "GET", token)
  return response?.ok === true
}

async function ciderRequest(endpoint, method = "GET") {
  const response = await request(endpoint, method, ciderToken)
  if (!response?.ok) return null
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch {
    return null
  }
}

function fixArtworkUrl(url) {
  return url
    .replaceAll("{w}", "80")
    .replaceAll("{h}", "80")
    .replaceAll("{f}", "jpg")
    .replace(/\/\d+x\d+bb\./, "/80x80bb.")
    .replace(/\/\d+x\d+/, "/80x80")
}

async function convertArtworkToBase64(artworkUrl) {
  if (!artworkUrl) return ""
  const url = fixArtworkUrl(artworkUrl)
  if (cachedArtwork.url === url) return cachedArtwork.data
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return ""
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = Buffer.from(await response.arrayBuffer())
    const data = `data:${contentType};base64,${buffer.toString("base64")}`
    cachedArtwork = { url, data }
    return data
  } catch {
    return ""
  }
}

export async function getTrackInfo() {
  if (!ciderToken) {
    return { title: "Set Cider Token", artist: "FlexDesigner Application Settings", artwork: "", isRunning: false }
  }
  const data = await ciderRequest("/playback/now-playing")
  const info = data?.info
  if (!info) {
    return { title: "Cider Offline", artist: "", artwork: "", isRunning: false }
  }
  const artworkUrl = info.artwork?.url || info.artworkUrl || info.attributes?.artwork?.url || ""
  return {
    title: info.name || info.title || info.attributes?.name || "No Song Playing",
    artist: info.artistName || info.artist || info.attributes?.artistName || "",
    artwork: await convertArtworkToBase64(artworkUrl),
    isRunning: true,
  }
}

export async function togglePlayPause() {
  return (await request("/playback/playpause", "POST", ciderToken))?.ok === true
}

export async function nextTrack() {
  return (await request("/playback/next", "POST", ciderToken))?.ok === true
}

export async function previousTrack() {
  return (await request("/playback/previous", "POST", ciderToken))?.ok === true
}

function normalizeVolume(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null
  const volume = Number(value)
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : null
}

export async function getVolume() {
  const data = await ciderRequest("/playback/volume")
  return normalizeVolume(data !== null && typeof data === "object" ? data.volume : data)
}

export async function setVolume(value) {
  const volume = normalizeVolume(value)
  if (volume === null) return false
  return (await request("/playback/volume", "POST", ciderToken, { volume }))?.ok === true
}
