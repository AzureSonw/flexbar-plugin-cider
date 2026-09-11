# Flexbar Cider 插件

在 Windows 11 上通过 FlexDesigner 和 Flexbar 控制 Cider。

English documentation: [README.md](README.md)

## 功能

- 上一首、播放/暂停、下一首。
- 原生 Volume 滑块，控制 Cider 自身的播放音量（0–100%）。
- Now Playing 按键显示专辑封面、歌曲名和歌手。
- 点击 Now Playing 按键的任意位置（包括封面）可切换播放状态。
- 使用电脑上的系统字体绘制中文、日文、韩文和带重音字符的文本，并保持封面比例。

插件 ID：`com.sonw.cider`。作者：Sonw。版本：`1.2.1`。

## 安装与连接

1. 在 FlexDesigner 的插件管理器中安装发布包 `com.sonw.cider.flexplugin`。
2. 打开 Cider，启用本地 RPC/API 服务，并获取你自己的 Cider API token。
3. 在 FlexDesigner 中打开 **设置 → 应用 → Cider**。
4. 将 token 填入 **Cider API Token**。
5. 点击 **TEST CONNECTION**。成功后会显示 **Connected to Cider**。
6. 点击 **SAVE SETTINGS**。保存的配置会立即生效。
7. 从 FlexDesigner 的按键库添加 Cider 按键，并按需添加 **Volume** 音量滑块。

插件连接到 `http://127.0.0.1:10767/api/v1`，使用 `apptoken` 请求头鉴权。
连接测试调用 `GET /playback/active`，所有成功的 HTTP 状态码（包括 204）都会视为成功。
测试 token 不会自动保存；要删除已保存的 token，请清空输入框后保存。

FlexDesigner 将 token 保存为插件应用配置中的 `ciderToken`。插件不声称对该配置加密，请勿分享本机 FlexDesigner 配置或日志。每位用户都应使用自己的 token，发布包不包含任何凭据。

现有 Cider 按键的 ID 和默认宽度保持不变：Now Playing 480、Play/Pause 80、Next 70、Previous 90。无需单独导入布局文件。

## 使用与故障排查

保持 Cider 运行并启用本地 API。Now Playing 每三秒刷新一次。

原生 **Volume** 滑块加载时会读取 Cider 当前音量，之后每三秒检查一次 Cider 内的音量变化。
拖动更新以 75 毫秒间隔合并，保留最新值；本地音量调整完成后再恢复外部同步。
音量控制继续使用应用设置中保存的个人 token。

如果显示 **Set Cider Token**，请配置并保存 token；如果连接测试失败，请确认 Cider 正在运行、本地 API 已启用且 token 正确。若个别字符缺字，请在 Windows 中安装对应语言的字体。

较长的歌名和歌手名会以省略号缩短，并且不会拆分 Unicode 字符簇。

Now Playing 使用按键加载时收到的宽度。封面距左侧 8 像素，封面与文字间距 10 像素；歌名和歌手共用余下的宽度，右侧留白 8 像素。FlexDesigner 2.2.3 实测加载事件中的 `key.width` 与 `key.style.width` 相同，因此保留优先使用运行时 `key.width`、缺失时使用 `style.width` 的逻辑。修改宽度后，请应用修改并上传布局，使按键重新加载。SDK 没有文档化的普通按键尺寸变化事件；三秒刷新只会使用最近一次加载的尺寸。

Volume 是原生滑块，轨道宽度与外框宽度独立。2.2.3 实测加载事件只提供 `key.width`，不提供 `style`；`setSlider` 更新数值，SDK 没有文档化的原生轨道改宽接口。加宽外框不会自动加宽轨道。新增 Volume 默认外框为 300 像素，轨道为 230 像素，图标为 28 像素并默认显示；预留的 70 像素由 50 像素图标区域和宿主的 20 像素轨道内缩组成，原生百分比格式不变。已有按键保留保存的样式。

其他 Volume 尺寸请在 FlexDesigner 的 **背景 → 宽度** 和 **前景 → 滑块宽度** 中分别调整，再应用并上传。使用上述图标默认值时，可将轨道设为 `外框宽度 - 70`，外框至少为 250 像素：2.2.3 的滑块编辑器要求轨道至少为 180 像素，220 像素外框无法保留同样的图标间距。这是手动调整的兼容性回退，不是自动响应式缩放。

1.2.1 修复了重新排列并上传布局后，相邻按键可能被 Now Playing 图片覆盖的问题。FlexDesigner 2.2.3 会重新分配按键编号而不发送旧按键的移除事件；插件现在按设备替换活动按键列表，并丢弃过期绘制。位图严格使用有效的加载宽度，缺失、冲突或非整数宽度会跳过绘制；极窄按键会收缩封面并省略无法容纳的文字。

## 从源码构建

请在 Windows x64 使用 **Node.js 20.20.2** 和 npm：

```sh
npm ci
npm test
npm run build
npm run plugin:validate
npm run plugin:pack
```

请使用 `.node-version` 或 `.nvmrc` 指定的 Node 版本。原生 Canvas 二进制文件与平台相关，因此 Windows 发布包应在 Windows x64 上构建。

Rollup 会从 `src/` 重新生成 `com.sonw.cider.plugin/backend/`，并打包 JavaScript 依赖、`skia-canvas` 原生文件和第三方许可证说明。FlexCLI 会校验标准插件目录并生成 `com.sonw.cider.flexplugin`。

不要把本地配置、日志、凭据或开发临时文件加入插件目录。

## 源码结构

- `src/plugin.js`：SDK 事件、配置更新、轮询、绘制和按键动作。
- `src/musicControl.js`：Cider 请求与封面获取。
- `src/canvasRenderer.js`：Now Playing 绘制器。
- `com.sonw.cider.plugin/manifest.json`：插件身份、四个普通按键、原生 Volume 滑块和配置页面。
- `com.sonw.cider.plugin/ui/global_config.vue`：应用设置页面。
- `rollup.config.mjs`：干净构建与原生资源打包。

字体使用 Microsoft YaHei、Microsoft JhengHei、Yu Gothic、Malgun Gothic、Segoe UI 和系统回退字体，不随插件打包。

## 参考

- [Flexbar SDK](https://flexdocumentation.readthedocs.io/en/latest/sdk/index.html)
- [插件结构](https://flexdocumentation.readthedocs.io/en/latest/sdk/plugin_structure.html)
- [YouTube Music 插件示例](https://github.com/MrCodeEU/Flexbar-Plugin-Youtube-Music-Desktop-App)
