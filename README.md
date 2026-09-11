# Cider for Flexbar

Control Cider from FlexDesigner and Flexbar on Windows 11 and macOS 15+.

中文说明：[README.zh-CN.md](README.zh-CN.md)

Release: `1.3.1`.

- Previous, Now Playing, Play/Pause, and Next.
- Native Volume slider for Cider playback volume (0–100%).
- Cider 4.0 Listening Mode: one cycle button and three direct mode buttons.
- Now Playing shows album artwork, title, and artist.
- Now Playing includes a thin, display-only playback timeline below the artist.
- Tap anywhere on Now Playing, including its cover, to toggle playback.
- Unicode text is rendered on the computer with system fonts.

Plugin ID: `com.sonw.cider`. Author: Sonw.

## Installation and connection

1. Download the package for your platform from [Releases](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest) and install it through FlexDesigner's plugin manager.
2. Open Cider and enable its local RPC/API service. Obtain your own Cider API token.
3. In FlexDesigner, open **Settings → Application → Cider**.
4. Enter the token in **Cider API Token**.
5. Click **TEST CONNECTION**. A successful test shows **Connected to Cider**.
6. Click **SAVE SETTINGS**. Saved changes take effect immediately.
7. Add the Cider keys from FlexDesigner's key library to your layout, including **Volume** if desired.

| Platform | Release package |
| --- | --- |
| Windows x64 | `com.sonw.cider.flexplugin` |
| macOS Apple Silicon | `com.sonw.cider.macos-arm64.flexplugin` |
| macOS Intel | `com.sonw.cider.macos-x64.flexplugin` |

Each package contains a platform-specific Canvas library. Choose the package matching
FlexDesigner's architecture (an Intel app running under Rosetta needs the Intel package).
macOS support is experimental: CI runs the automated tests and loads the native library
on both architectures, but physical Flexbar testing has only been completed on Windows.

Playback and Volume connect to `http://127.0.0.1:10767/api/v1` using the `apptoken` header.
Listening Mode uses `/api/v2/audio/listening-mode` with the same saved token.
The test uses `GET /playback/active` and accepts all successful HTTP responses, including 204.
Testing a token does not save it. To remove a saved token, empty the field and save.

FlexDesigner stores the token in its plugin application configuration under `ciderToken`.
No encryption claim is made. Do not share your local FlexDesigner configuration or logs.
Each user supplies their own token; no credential is included in the release.

Existing Cider keys keep their IDs and default widths: Now Playing 480, Play/Pause 80,
Next 70, Previous 90. A separate layout import is not required.

## Usage and troubleshooting

Keep Cider running with its RPC service available. Now Playing polls Cider v2 playback
timing about once per second and reuses cached metadata/artwork between metadata
refreshes (about every three seconds, or on a track change).
Artwork fills a 58×58 square at (1,1), surrounded by a 1-pixel black border on the 60-pixel canvas.
Non-square covers are center-cropped without stretching; narrow keys shrink the cover safely.
Long titles and artist names are shortened with an ellipsis without splitting Unicode graphemes.

Now Playing uses the width received when the key loads. Title and artist retain the
same horizontal centered text allocation as 1.2.1, independent of the larger cover. A small saved
icon size can limit the cover so it does not enter the existing text area.
In FlexDesigner 2.2.3, the observed Now Playing load
event contains matching `key.width` and `key.style.width`; the renderer keeps the
runtime `key.width` first, with `style.width` as a fallback. Apply width edits and
upload the layout so FlexDesigner reloads the keys. The SDK has no documented normal-key
resize event; subsequent redraws reuse the last loaded dimensions.

The timeline is 2 pixels high at y=50, with a dark-gray track and a white played
section. It starts 45 pixels after the actual cover edge and ends 45 pixels before
the canvas edge, so its length follows the loaded key width. Title/artist use
centered vertical anchors y=15/y=34 (y=26 for a title without an artist).
Invalid timing or insufficient width hides the timeline. Paused snapshots do not
advance locally, and identical frames are skipped. Tapping any part of Now Playing
still toggles playback; the timeline cannot seek. No new key or native slider is added.

Volume uses a native slider with a separate, fixed track width. In the observed 2.2.3
load event it receives `key.width` but no `style`; `setSlider` updates its value, and
the SDK documents no native-track resize API. Widening the outer key does not
automatically grow the track. New Volume keys default to a 300-pixel outer width,
a 230-pixel track, and a visible 28-pixel icon. The 70-pixel reserve leaves a
50-pixel icon area plus the host's 20-pixel track inset; the native percentage format
remains unchanged. Existing keys keep their saved styles.

For other Volume sizes, adjust **Background → Width** and **Foreground → Slider Width**
in FlexDesigner, then apply and upload. With these icon defaults, use a track width
of `outer width - 70` and an outer width of at least 250 pixels: the 2.2.3 slider editor
has a 180-pixel track minimum, so a 220-pixel key cannot retain the same icon clearance.
This is a manual sizing fallback, not automatic responsive resizing.

The native **Volume** slider controls Cider's own playback volume. It reads the current
volume when loaded and checks for changes in Cider every three seconds. Drag updates
are combined at 75 ms intervals, keeping the latest value; incoming synchronization
waits until the local change finishes. Each user keeps using their own saved token.

If the display says **Set Cider Token**, configure and save the token.
If connection testing fails, check that Cider is running, the local API is enabled,
and the token is correct. Save the token after a successful test.
If glyphs are missing, check that your computer has fonts for the relevant language installed.

Version 1.2.1 fixes adjacent keys receiving a stale Now Playing image after a layout
re-upload. FlexDesigner 2.2.3 reassigns numeric key UIDs without sending a removal
event. Each load now replaces that device's active keys and invalidates obsolete
renders. Missing, inconsistent, or non-integer widths are rejected, and very narrow
keys shrink the cover and omit text that cannot fit.

## Listening Mode

Add **Listening Mode** to cycle **Off → Gaming → Unwind → Off**, or add the three
**Listening Mode - Off / Gaming / Unwind** buttons to select a mode directly.
The cycle button displays the current mode's icon and label. Direct buttons retain
their own icons and highlight the active mode with a blue background.

All four controls share Cider's current state. Successful changes update immediately;
changes made inside Cider synchronize on the existing three-second refresh.
Listening Mode requires Cider 4.0's v2 API. If it is unavailable, playback, Volume,
and Now Playing continue working. All controls use the same application token.

FlexDesigner's plugin **Homepage** opens this repository.

During development, stop an old linked backend before loading a replacement. If an
update appears inactive, restart FlexDesigner after saving your layout; two backend
processes using the same plugin ID can otherwise keep an older version active.

## Build from source

Build on **Windows x64 or macOS (Apple Silicon / Intel) using Node.js 20.20.2** and npm:

```sh
npm ci
npm test
npm run build
npm run plugin:validate
npm run plugin:pack
```

The pinned legacy FlexCLI uses JSON import assertions that newer Node versions no longer accept.
Use the Node version in `.node-version` / `.nvmrc`.
The native Canvas binary is platform-specific. Build on the OS and architecture you intend to use.
The release workflow builds and tests Windows x64, macOS arm64, and macOS x64 separately.

Rollup recreates `com.sonw.cider.plugin/backend/` from `src/`.
It bundles JavaScript dependencies, emits the installed `skia-canvas` native binary,
and includes the project license and third-party license notices. The bundle stays unminified because native Canvas
bindings depend on JavaScript class names. Runtime dependencies do not need a `node_modules` folder.

FlexCLI validates and packs the standard plugin folder into `com.sonw.cider.flexplugin`.
Do not add local configuration, logs, credentials, or development files to that folder.

## Source layout

- `src/plugin.js`: SDK events, configuration updates, polling, drawing, and button actions.
- `src/musicControl.js`: Cider requests and artwork retrieval.
- `src/canvasRenderer.js`: focused Now Playing renderer.
- `com.sonw.cider.plugin/manifest.json`: plugin identity, eight buttons, the native Volume slider, repository link, and `configPage: "global_config"`.
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

## License

[MIT License](LICENSE), copyright © 2026 Sonw. The release includes this license in
`resources/LICENSE.txt`; bundled dependencies retain their own licenses, listed in
`resources/THIRD_PARTY_LICENSES.txt`.
