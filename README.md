# Cider for Flexbar

Control Cider from FlexDesigner and Flexbar on Windows 11.

中文说明：[README.zh-CN.md](README.zh-CN.md)

Release: `1.1.0`.

- Previous, Now Playing, Play/Pause, and Next.
- Native Volume slider for Cider playback volume (0–100%).
- Now Playing shows album artwork, title, and artist.
- Tap anywhere on Now Playing, including its cover, to toggle playback.
- Unicode text is rendered on the computer with system fonts.

Plugin ID: `com.sonw.cider`. Author: Sonw.

## Installation and connection

1. Install the release `com.sonw.cider.flexplugin` through FlexDesigner's plugin manager.
2. Open Cider and enable its local RPC/API service. Obtain your own Cider API token.
3. In FlexDesigner, open **Settings → Application → Cider**.
4. Enter the token in **Cider API Token**.
5. Click **TEST CONNECTION**. A successful test shows **Connected to Cider**.
6. Click **SAVE SETTINGS**. Saved changes take effect immediately.
7. Add the Cider keys from FlexDesigner's key library to your layout, including **Volume** if desired.

The plugin connects to `http://127.0.0.1:10767/api/v1` using the `apptoken` header.
The test uses `GET /playback/active` and accepts all successful HTTP responses, including 204.
Testing a token does not save it. To remove a saved token, empty the field and save.

FlexDesigner stores the token in its plugin application configuration under `ciderToken`.
No encryption claim is made. Do not share your local FlexDesigner configuration or logs.
Each user supplies their own token; no credential is included in the release.

Existing Cider keys keep their IDs and default widths: Now Playing 480, Play/Pause 80,
Next 70, Previous 90. A separate layout import is not required.

## Usage and troubleshooting

Keep Cider running with its RPC service available. Now Playing refreshes every three seconds.
Artwork preserves its aspect ratio inside the existing cover area.
Long titles and artist names are shortened with an ellipsis without splitting Unicode graphemes.

The native **Volume** slider controls Cider's own playback volume. It reads the current
volume when loaded and checks for changes in Cider every three seconds. Drag updates
are combined at 75 ms intervals, keeping the latest value; incoming synchronization
waits until the local change finishes. Each user keeps using their own saved token.

If the display says **Set Cider Token**, configure and save the token.
If connection testing fails, check that Cider is running, the local API is enabled,
and the token is correct. Save the token after a successful test.
If glyphs are missing, check that Windows has fonts for the relevant language installed.

## Build from source

Build on **Windows x64 using Node.js 20.20.2** and npm:

```sh
npm ci
npm run build
npm run plugin:validate
npm run plugin:pack
```

The pinned legacy FlexCLI uses JSON import assertions that newer Node versions no longer accept.
Use the Node version in `.node-version` / `.nvmrc`.
The native Canvas binary is platform-specific, so this Windows release must be built on Windows x64.

Rollup recreates `com.sonw.cider.plugin/backend/` from `src/`.
It bundles JavaScript dependencies, emits the installed `skia-canvas` native binary,
and generates third-party license notices. The bundle stays unminified because native Canvas
bindings depend on JavaScript class names. Runtime dependencies do not need a `node_modules` folder.

FlexCLI validates and packs the standard plugin folder into `com.sonw.cider.flexplugin`.
Do not add local configuration, logs, credentials, or development files to that folder.

## Source layout

- `src/plugin.js`: SDK events, configuration updates, polling, drawing, and button actions.
- `src/musicControl.js`: Cider requests and artwork retrieval.
- `src/canvasRenderer.js`: focused Now Playing renderer.
- `com.sonw.cider.plugin/manifest.json`: plugin identity, four buttons, the native Volume slider, and `configPage: "global_config"`.
- `com.sonw.cider.plugin/ui/global_config.vue`: application settings.
- `rollup.config.mjs`: clean runtime build and native asset packaging.

The renderer uses `skia-canvas` with Microsoft YaHei, Microsoft JhengHei, Yu Gothic,
Malgun Gothic, Segoe UI, and system fallback fonts. Fonts are not bundled.
It creates a 60-pixel-high PNG with `canvas.toDataURL("image/png")` and sends it through
`plugin.draw(serialNumber, key, "base64", imageData)`.

## Implementation references

- [Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html)
- [Plugin structure](https://flexdocumentation.readthedocs.io/en/latest/sdk/plugin_structure.html)
- [YouTube Music plugin](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)
