const API_BASE = "http://127.0.0.1:10767/api/v1"
const API_V2_BASE = "http://127.0.0.1:10767/api/v2"
const LISTENING_MODES = ["off", "game", "antifatigue"]
let ciderToken = ""
let cachedArtwork = { url: "", data: "" }

export function setCiderToken(value) {
  ciderToken = typeof value === "string" ? value : ""
}

async function request(endpoint, method, token, body, base = API_BASE) {
  if (!token) return null
  try {
    return await fetch(`${base}${endpoint}`, {
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
    trackId: playbackTrackId(info),
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

function playbackTrackId(info) {
  if (!info || typeof info !== "object") return null
  const attributes = info.attributes ?? info
  const id = info.playParams?.id ?? info.id ?? attributes.playParams?.id
  if (typeof id === "string" && id) return id
  // Some streams have no catalogue ID; use the same identity in v1 and v2.
  const title = attributes.name ?? attributes.title
  return typeof title === "string" && title
    ? JSON.stringify([title, attributes.artistName ?? attributes.artist ?? "", attributes.albumName ?? ""])
    : null
}

export async function getPlaybackProgress() {
  const response = await request("/playback", "GET", ciderToken, undefined, API_V2_BASE)
  if (!response?.ok) return null
  try {
    const body = await response.json()
    const data = body?.data ?? body
    const currentTime = data?.time?.currentTime
    const duration = data?.time?.duration
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0 || data.nowPlaying === null) return null
    return {
      currentTime: Math.max(0, Math.min(duration, currentTime)),
      duration,
      state: typeof data.state === "string" ? data.state : "unknown",
      trackId: playbackTrackId(data.nowPlaying),
    }
  } catch {
    return null
  }
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

function listeningModeFromResponse(data) {
  const mode = data?.data?.mode ?? data?.mode
  return LISTENING_MODES.includes(mode) ? mode : null
}

export async function getListeningMode() {
  const response = await request("/audio/listening-mode", "GET", ciderToken, undefined, API_V2_BASE)
  if (!response?.ok) return null
  try {
    return listeningModeFromResponse(await response.json())
  } catch {
    return null
  }
}

export async function setListeningMode(mode) {
  if (!LISTENING_MODES.includes(mode)) return null
  const response = await request("/audio/listening-mode", "PATCH", ciderToken, { mode }, API_V2_BASE)
  if (!response?.ok) return null
  try {
    // Some Cider versions acknowledge the write without returning a mode.
    return listeningModeFromResponse(await response.json()) ?? mode
  } catch {
    return mode
  }
}
