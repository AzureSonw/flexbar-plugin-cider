# 🎵 Flexbar Cider 插件

在 Flexbar 上查看 Cider 专辑封面和实时播放进度，控制播放、音量与聆听模式。

[![最新版本](https://img.shields.io/github/v/release/AzureSonw/flexbar-plugin-cider?label=release&color=5865f2)](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest) [![Cider 4.0](https://img.shields.io/badge/Cider-4.0-ec4899)](#-快速开始) [![FlexDesigner 2.2.2+](https://img.shields.io/badge/FlexDesigner-2.2.2%2B-5865f2)](#-快速开始) [![Windows 11](https://img.shields.io/badge/Windows-11-0078d4)](#-下载与平台支持) [![macOS 15+ 实验性支持](https://img.shields.io/badge/macOS-15%2B%20experimental-6b7280)](#-下载与平台支持) [![MIT 许可证](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

[English](README.md) · 当前版本：[v1.4.0](https://github.com/AzureSonw/flexbar-plugin-cider/releases/tag/v1.4.0)

## ✨ 功能

- **🎵 Now Playing：** 显示专辑封面、Unicode 歌名和歌手，歌手下方的实时进度条随按键宽度调整。进度条仅供显示，点击按键任意位置可播放或暂停。
- **⏯️ 播放控制：** 上一首、播放/暂停、下一首。
- **🔊 音量：** 原生滑块控制 Cider 的播放音量，并同步 Cider 内的音量变化。
- **🎧 聆听模式：** 按 **Off → Gaming → Unwind → Off** 循环，或用独立按钮直接选择模式。四个按钮均与 Cider 同步。

## 🚀 快速开始

需要 Flexbar，以及安装在同一台电脑上的 **Cider 4.0** 和 **FlexDesigner 2.2.2+**。

1. 从 Releases 下载[对应平台的安装包](#-下载与平台支持)。
2. 通过 FlexDesigner 的插件管理器安装 `.flexplugin` 文件。
3. 按下方教程[创建并复制 Cider token](#-获取-cider-api-token)。
4. 打开 **FlexDesigner → Settings → Application → Cider**（设置 → 应用 → Cider），将 token 粘贴到 **Cider API Token**。
5. 点击 **TEST CONNECTION**，确认显示 **Connected to Cider**，再点击 **SAVE SETTINGS**。
6. 从按键库添加 Cider 控件到布局，保存并上传到 Flexbar。

## 🔑 获取 Cider API Token

### 在 Cider 中

1. 打开 **Cider → 设置 → 连接**。
2. 找到 **外部应用** 下的 **WebSockets API**，保持 API 服务启用。
3. 点击 **Manage External Application Access to Cider**。
4. 点击 **新建** 创建 token。
5. 在新建的条目上点击 **拷贝**。

### 在 FlexDesigner 中

1. 打开 **Settings → Application → Cider**（设置 → 应用 → Cider）。
2. 将复制的 token 粘贴到 **Cider API Token**。
3. 点击 **TEST CONNECTION**，确认显示 **Connected to Cider**。
4. 点击 **SAVE SETTINGS**，保存后生效。

连接测试不会自动保存 token。请妥善保管 token，并在使用插件时保持 Cider 运行。

## 🎛️ 可用控制

| 控件 | 功能 |
| --- | --- |
| Now Playing | 显示封面、歌名/歌手和播放进度；点击可播放或暂停。 |
| Previous | 上一首。 |
| Play/Pause | 切换播放或暂停。 |
| Next | 下一首。 |
| Volume | 调整 Cider 的播放音量，范围为 0–100%。 |
| Listening Mode | 按 Off → Gaming → Unwind → Off 循环。 |
| Listening Mode - Off | 直接选择 Off。 |
| Listening Mode - Gaming | 直接选择 Gaming。 |
| Listening Mode - Unwind | 直接选择 Unwind。 |

循环按钮显示当前模式，独立按钮用蓝色背景高亮当前模式。图标对应：Off 为 `close-box-outline`，Gaming 为 `gamepad-variant-outline`，Unwind 为 `bed-king-outline`。

进度条不能拖动或跳转播放位置；时间信息不可用或按键过窄时会隐藏。调整 Now Playing 宽度后，请应用修改并上传布局。

## 📦 下载与平台支持

从[最新 Release](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest) 下载：

| 平台 | 安装包 |
| --- | --- |
| Windows 11 x64 | [com.sonw.cider.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.flexplugin) |
| macOS 15+ Apple Silicon | [com.sonw.cider.macos-arm64.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.macos-arm64.flexplugin) |
| macOS 15+ Intel | [com.sonw.cider.macos-x64.flexplugin](https://github.com/AzureSonw/flexbar-plugin-cider/releases/latest/download/com.sonw.cider.macos-x64.flexplugin) |

macOS 为**实验性支持**：两种架构均通过 CI 检查，实体 Flexbar 测试目前仅在 Windows 上完成。macOS 用户可能需要从 GitHub 手动下载对应安装包。

安装包应匹配 FlexDesigner 的运行架构：通过 Rosetta 运行 Intel 版 FlexDesigner 时，请选择 Intel 包。

## 🔧 故障排查

| 问题 | 处理方法 |
| --- | --- |
| 连接测试失败 | 保持 Cider 运行，检查 **Settings → Connectivity → External Applications → RPC Server**。从 **Manage External Application Access to Cider** 重新复制 token，正确粘贴并测试后，点击 **SAVE SETTINGS**。另外请确认安装包与平台和架构匹配：例如 macOS 安装了 Windows 版安装包，或下载了错误的 macOS 架构版本，也可能导致连接测试失败。 |
| 显示 **Set Cider Token** | 在 **FlexDesigner → Settings → Application → Cider** 中配置并保存 token。 |
| 更新似乎没有生效 | 保存并上传布局，然后重启 FlexDesigner，清理仍在运行的旧链接后端。 |
| 部分字符缺失 | 安装对应语言的系统字体；插件不附带字体。 |

## 🛠️ 从源码构建

使用 **Node.js 20.20.2**（见 [.node-version](.node-version)）和 npm，在仓库目录运行：

```sh
npm ci
npm test
npm run build
npm run plugin:validate
npm run plugin:pack
```

请在目标系统及架构上构建，Canvas 原生组件与平台相关。输出文件为 `com.sonw.cider.flexplugin`；正式发布会分别构建 Windows x64、macOS arm64 和 macOS x64 安装包。

## 📁 项目结构

| 文件 | 用途 |
| --- | --- |
| [src/plugin.js](src/plugin.js) | FlexDesigner 集成与控件操作。 |
| [src/musicControl.js](src/musicControl.js) | 与 Cider 通信并获取封面。 |
| [src/canvasRenderer.js](src/canvasRenderer.js) | 绘制 Now Playing。 |
| [manifest.json](com.sonw.cider.plugin/manifest.json) | 插件信息与控件定义。 |
| [ui/global_config.vue](com.sonw.cider.plugin/ui/global_config.vue) | Token 设置与连接测试。 |

## 📄 许可证与参考

[MIT License](LICENSE) · © 2026 Sonw。安装包包含项目及第三方许可证说明。

[Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html) · [YouTube Music 插件 — README 风格参考](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)
