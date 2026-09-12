# 🎵 Cider for Flexbar

Control Cider from Flexbar with album artwork, live playback progress, playback buttons, Volume, and Listening Mode.

[![Latest release](https://img.shields.io/github/v/release/AzureSonw/flexbar-plugin-cider?label=release&color=5865f2)](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest) [![Cider 4.0](https://img.shields.io/badge/Cider-4.0-ec4899)](#-quick-start) [![FlexDesigner 2.2.2+](https://img.shields.io/badge/FlexDesigner-2.2.2%2B-5865f2)](#-quick-start) [![Windows 11](https://img.shields.io/badge/Windows-11-0078d4)](#-downloads) [![macOS 15+ experimental](https://img.shields.io/badge/macOS-15%2B%20experimental-6b7280)](#-downloads) [![MIT License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

[简体中文](README.zh-CN.md) · Current release: [v1.4.0](https://github.com/AzureSonw/flexbar-plugin-cider/releases/tag/v1.4.0)

## ✨ Features

- **🎵 Now Playing:** Album artwork, Unicode title/artist, and a thin live timeline below the artist. The timeline scales with the key width and is display-only; tap anywhere on the key to play/pause.
- **⏯️ Playback:** Previous, Play/Pause, and Next buttons.
- **🔊 Volume:** A native slider controls Cider's playback volume and follows changes made in Cider.
- **🎧 Listening Mode:** Cycle **Off → Gaming → Unwind → Off**, or select each mode directly. All four controls stay synchronized with Cider.

## 🚀 Quick Start

You need a Flexbar and a computer running **Cider 4.0** and **FlexDesigner 2.2.2+**.

1. Download the [package for your platform](#-downloads) from Releases.
2. Install the `.flexplugin` file through FlexDesigner's plugin manager.
3. [Create and copy your Cider token](#-get-your-cider-api-token).
4. Open **FlexDesigner → Settings → Application → Cider** and paste it into **Cider API Token**.
5. Click **TEST CONNECTION**, confirm **Connected to Cider**, then click **SAVE SETTINGS**.
6. Add Cider controls from the key library to your layout, save, and upload to Flexbar.

## 🔑 Get Your Cider API Token

### In Cider

1. Open **Cider → Settings → Connectivity**.
2. Find **External Applications**, then **RPC Server**. Keep the RPC server enabled.
3. Click **Manage External Application Access to Cider**.
4. Click **Create New** to create a token.
5. Click **Copy Token** for the new entry.

### In FlexDesigner

1. Open **Settings → Application → Cider**.
2. Paste the copied token into **Cider API Token**.
3. Click **TEST CONNECTION** and confirm **Connected to Cider**.
4. Click **SAVE SETTINGS** to apply it.

Testing does not save the token. Keep your token private and leave Cider running while using the plugin.

## 🎛️ Available Controls

| Control | What it does |
| --- | --- |
| Now Playing | Shows artwork, title/artist, and a playback timeline; tap to play/pause. |
| Previous | Goes to the previous track. |
| Play/Pause | Toggles playback. |
| Next | Goes to the next track. |
| Volume | Adjusts Cider's playback volume from 0–100%. |
| Listening Mode | Cycles Off → Gaming → Unwind → Off. |
| Listening Mode - Off | Selects Off. |
| Listening Mode - Gaming | Selects Gaming. |
| Listening Mode - Unwind | Selects Unwind. |

The cycle button shows the current mode; direct buttons highlight the active mode in blue. Icons: Off `close-box-outline`, Gaming `gamepad-variant-outline`, Unwind `bed-king-outline`.

The timeline cannot be dragged or used to seek. It hides when timing is unavailable or the key is too narrow. After resizing Now Playing, apply the change and upload the layout.

## 📦 Downloads

Download from the [latest release](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest):

| Platform | Package |
| --- | --- |
| Windows 11 x64 | [com.sonw.cider.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.flexplugin) |
| macOS 15+ Apple Silicon | [com.sonw.cider.macos-arm64.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.macos-arm64.flexplugin) |
| macOS 15+ Intel | [com.sonw.cider.macos-x64.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.macos-x64.flexplugin) |

macOS support is **experimental**: both builds pass CI, but physical Flexbar testing has only been completed on Windows. You may need to download the matching macOS package manually from GitHub.

Match FlexDesigner's architecture: Intel FlexDesigner running under Rosetta needs the Intel package.

## 🔧 Troubleshooting

| Problem | What to check |
| --- | --- |
| Connection test fails | Keep Cider running; check **Settings → Connectivity → External Applications → RPC Server**. Copy the token again from **Manage External Application Access to Cider**, paste it correctly, test, then click **SAVE SETTINGS**. |
| **Set Cider Token** appears | Configure and save the token in **FlexDesigner → Settings → Application → Cider**. |
| An update appears inactive | Save and upload the layout, then restart FlexDesigner to clear an older linked backend. |
| Missing characters | Install a system font for the affected language; fonts are not bundled. |

## 🛠️ Build from Source

Use **Node.js 20.20.2** (see [.node-version](.node-version)) and npm in the repository folder:

```sh
npm ci
npm test
npm run build
npm run plugin:validate
npm run plugin:pack
```

Build on the target OS and architecture: the Canvas native library is platform-specific. The output is `com.sonw.cider.flexplugin`; official releases build Windows x64, macOS arm64, and macOS x64 separately.

## 📁 Project Structure

| File | Purpose |
| --- | --- |
| [src/plugin.js](src/plugin.js) | FlexDesigner integration and control actions. |
| [src/musicControl.js](src/musicControl.js) | Cider communication and artwork retrieval. |
| [src/canvasRenderer.js](src/canvasRenderer.js) | Now Playing display. |
| [manifest.json](com.sonw.cider.plugin/manifest.json) | Plugin metadata and controls. |
| [ui/global_config.vue](com.sonw.cider.plugin/ui/global_config.vue) | Token settings and connection test. |

## 📄 License & References

[MIT License](LICENSE) · © 2026 Sonw. Releases include project and third-party license notices.

[Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html) · [YouTube Music plugin — README style reference](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)
