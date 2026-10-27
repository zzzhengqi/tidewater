# Tidewater（zzzhengqi fork）进度记录

开工前先读这份文件，收工时更新它。

## 产品定位（不变的约束）

- "个人私密世界"：核心是自由调时间 / 太阳方位 / 海浪，潜水、开船、自由相机飞行。
- 钓鱼是保留的**可选**玩法之一，不能让项目变成"只是钓鱼游戏"。不加金币驱动的新系统、排行榜、强制任务。
- 所有用户可见文字走多语言机制；新增 key 必须同时补全所有已支持语言。
- 不引入联网素材；保持性能；不让已有功能退化。
- 每个阶段结束 git commit，`npm run build` 与 `npm test` 必须通过。

## 分支与远端

| 名称 | 指向 | 说明 |
|---|---|---|
| `origin` | github.com/zzzhengqi/tidewater | 我的 fork |
| `upstream` | github.com/dgreenheck/tidewater | 上游（自研 WebGPU 引擎 + WGSL，带钓鱼玩法） |
| `backup-fork-old` | `d9fcc35` | 换底座前的旧 main（three.js/TSL 版 + 多语言）。**不要动它**，是退路 |
| `main-v2` | 基于 `upstream/main` `4811ba4`，已推送到 `origin/main-v2` | 新版开发分支（新底座 + 多语言 + 轮盘 / 玩法选项） |
| `main` | 与 `origin/main` 一致（旧版） | 线上站点从这里部署；新版完成前不要覆盖 |

旧 fork 相对上游合并基点 `d32799f` 只有 3 个自己的提交：`6606368`（设置面板多语言、独立预览）、`35310a5`（语言菜单配色）、
`d9fcc35`（README 演示链接指向本 fork）。这些改动已全部移植到 `main-v2`，three.js 代码没有带回来。

## 上游引擎结构概述

- `src/engine/`：自研渲染引擎。CPU 侧是与 three.js 接口相近的数学 / 场景 / 几何（`Vector3`、`Mesh`、`BufferGeometry`…），
  GPU 侧（`engine/webgpu.js`）是 `GPU` 单例、`Texture` / `RenderTarget`、`UniformBlock`、`ShaderModule`（WGSL 片段按前缀共享）、
  `ComputeKernel`、`Material`、`MeshRenderer`、`FullscreenPass`、阴影 `SunShadows`、蒙皮 `SkinnedModel`。移植约定见 `docs/PORTING.md`。
- `src/App.js`：启动顺序（大气 → 地形 → 村庄 → 植被 → 海浪 → 珊瑚礁 → 海洋 → 着色器编译 → 预热），每帧更新与渲染。
- 系统目录：`ocean/`（FFT 海洋、岸浪、碎浪、航迹、焦散、水下光照）、`sky/`、`world/`、`post/`（AO、TAAU、动态模糊、泛光、镜头光晕…）、
  `materials/`、`player/`（步行、游泳、开船、自由相机）、`audio/`、`fx/`。
- `src/game/`：钓鱼玩法。`Game.js`（总控、提示、吐司）、`GameHUD.js`（钱包 / 冷藏箱 / 油量 / 声呐、搏鱼条、渔获卡片、冷藏箱面板、
  鱼摊与船具店面板）、`Guide.js`（新手引导 3 张卡片 + 一次性提示）、`Minimap.js`、`FishTable.js`（18 种鱼）、`Gear.js`（升级）、
  `Vendor.js` / `FishStand.js` / `Chandlery.js`（乔与玛尔塔）、`FishPortrait.js`（渔获卡片里的实时 3D 鱼）。
- `src/ui/`：`UI.js`（通用设置面板组件、HUD、帮助、开始画面、加载器）、`AppUI.js`（把设置项绑到 App）、`i18n.js` + `locales/`（多语言）。
- `index.html`：加载器的静态标记（带 `data-i18n`）。
- 测试：`test/i18n-check.mjs`、`test/i18n.test.mjs`、`test/game-logic.mjs`、`test/engine-smoke.mjs`（Node 里用 Dawn 无头 WebGPU 跑引擎冒烟）。

## 多语言机制

支持语言：`en`（源语言）、`zh-CN`、`ja`、`ko`、`ar`。列表在 `src/ui/i18n.js` 的 `languages`。

### 运行时（`src/ui/i18n.js`）

- `t( key, params )`：取当前语言的文字，`{name}` 占位符由 `params` 填充。当前语言缺这个 key（或为空）时**回退到英文并在控制台警告一次**；
  英文也没有则返回 key 本身并警告。
- `phrase( english )`：把一段英文源文字翻译成当前语言（按 en.js 的值反查 key）。只在这些命名空间里反查：
  `language ui settings options phase mode prompt toast loader error`，避免把按键 `E`、数字之类误翻。用于：
  - 设置面板 / 侧栏：`AppUI.js` 用英文标签搭建，`UI.js` 里的 `MutationObserver` 把面板里的文本节点和
    `aria-label / data-tip / data-tip-hint / title / placeholder / aria-valuetext` 原地翻译，切换语言时从记录的英文原文重新翻译（沿用旧 fork 的做法）。
  - HUD 的模式标签（`setMode`）、交互提示（`setPrompt`，玩家模块传英文）、吐司（`toast`）、加载状态（`setLoading`）。
- `setLanguage( code )`：保存到 `localStorage['tidewater.ui.language']`，更新 `<html lang>`，重刷所有 `data-i18n` 静态标记，通知订阅者。
- `onLanguageChange( fn )`：订阅切换；`UI`、`GameHUD`、`Guide`、`Minimap` 都订阅了，切换后已打开的面板 / 卡片 / 引导会立即重绘。
- 默认语言：有保存的选择用保存的；否则按浏览器语言列表，`zh*` → `zh-CN`，`ja` / `ko` / `ar` 各自对应，其余英文。
- `localizeStatic( root )`：`data-i18n="key"`（写 innerHTML）与 `data-i18n-attr="aria-label:key;title:key"`。
- 语言选择器在设置面板标题栏（`H` 打开）。阿拉伯语时设置标签、钓鱼面板、引导卡片为 RTL（`ui.css` 末尾的 `[data-lang='ar']` 规则）。

### 新增 / 修改一条界面文字要改哪里

1. 在 `src/ui/locales/en.js` 加 key（按命名空间分组：`ui.` 面板外壳、`settings.` 设置项、`hud.` HUD、`prompt.` 交互提示、
   `toast.` 吐司、`loader.` 加载器、`help.` 帮助页、`start.` 开始画面、`fish.<id>` 鱼名、`gear.<track>[.<level>]` 装备、
   `vendor.<id>.*` 商贩、`catch.` 渔获卡片、`inv.` 冷藏箱、`stand.` 鱼摊、`shop.` 船具店、`game.` 钓鱼吐司、`guide.` / `tip.` 引导、
   `unit.` 单位、`dir.` 方位、`key.` 按键名、`keys.` 帮助页键位说明、`wheel.` 轮盘、`equip.` 装备项、`options.` 玩法选项、`error.` 错误）。
2. **同一次提交**里在 `zh-CN.js`、`ja.js`、`ko.js`、`ar.js` 补上同一个 key，占位符 `{x}` 必须一致。值可以含 `<b> <kbd> <small> <p>`。
3. 代码里：
   - 游戏 / HUD 代码直接 `t( 'key', { … } )`（`Guide.js`、`Minimap.js`、`UI.js` 里导入为 `tr`，避免和局部变量 `t` 冲突）。
   - 设置面板：`AppUI.js` 照常写英文 `label` / `tooltip`，只要 en.js 的 `settings.*` 里有同样的英文就会被翻译。
   - 玩家提示 / 模式 / 吐司 / 加载状态可以传英文（会走 `phrase()`），但英文必须在对应命名空间里有条目。
   - 单位用 `src/game/text.js` 的 `kg() cm() metres() litres() money()`，中文显示公斤、厘米、米、升。
4. `npm run i18n:check`（已并入 `npm test`）会报：某语言缺 key、多余 key、空翻译、占位符不一致、代码里 `t('…')` 用了不存在的 key、
   走 `phrase()` 的英文没有条目、`GameHUD / Guide / Minimap` 的标记里残留英文句子。
5. `npm run i18n:preview` 重新生成 `test/i18n.html`，直接用浏览器打开（不需要 WebGPU、不需要服务器），底部工具栏切语言和画面。

新增一种语言：在 `languages` 里加一行，新建 `locales/<code>.js`（所有 key），在 `i18n.js` 顶部 import 并放进 `locales`。

## 键位表（最终版，来源：`src/core/Keymap.js`）

F1 帮助页由 `Keymap.js` 的 `KEYMAP` 自动生成，不再手写；带 `option` 的行只在对应玩法开关打开时出现。
`test/keymap.test.mjs` 保证：代码里读取的每个按键都在注册表里（菜单导航键 Enter / 方向键 / Home / End 除外），
没有一个键绑两个功能，**字母键集合固定为 W A S D C E R V F T L M H P I**。新功能不再分配字母键，
放进轮盘（R）或设置面板（H）。

| 键 | 作用 | 备注 |
|---|---|---|
| W A S D | 移动、游泳、驾船转向 | |
| 鼠标移动 | 环顾 | 点击画面锁定鼠标 |
| Shift | 冲刺、船只加速、自由相机加速 | |
| Space | 跳跃、向上游、爬梯子、自由相机上升 | |
| C | 下蹲、下潜、自由相机下降 | 去掉了旧的 Q（自由相机下降）和左 Ctrl（下潜，Ctrl+W 会关掉浏览器标签） |
| E | 互动：登船、掌舵、上岸、与商贩交谈；关闭渔获卡片 | 去掉了旧的"自由相机里 E = 上升" |
| R | **装备轮盘**（点按打开；再按 R 顺时针切换；鼠标选扇区 + 左键或 Enter 确认；Esc / 右键 / 移动键关闭不切换） | 原"取出 / 收起鱼竿"并入轮盘 |
| 左键 | 使用手中装备（鱼竿：按住蓄力松开抛竿、提竿、按住收线） | 仅钓鱼开启时列出 |
| 右键 | 鱼竿：收回空线 | 仅钓鱼开启时列出 |
| I / Tab | 冷藏箱与鱼类图鉴 | 仅钓鱼开启时可用 |
| V | 掌舵时切换第一 / 第三人称 | |
| F | 自由相机 | |
| T | 暂停 / 恢复时间 | |
| L | 手电筒 | |
| M | 静音 | |
| H | 设置面板 | |
| P | 拍照模式 | |
| F1 / ? | 操作说明（自动生成） | |
| Esc | 返回：关闭面板或轮盘、释放鼠标 | |

改键或加键：只改 `KEYMAP`（`codes` 是 `KeyboardEvent.code`，`label` / `sub` 是 i18n key），代码里用
`pressed( input, 'id' )` 或 `codesOf( 'id' )` 读取，不要再写字面量键码。

## 轮盘与装备注册表

- `src/ui/RadialWheel.js`：通用轮盘组件，可以挂多个（以后的相机轮盘就是再 new 一个，换一个注册表和 onSelect）。
  ```js
  new RadialWheel( ui, {
    title: 'wheel.equipment',              // 中央小标题的 i18n key
    registry,                              // ItemRegistry
    current: () => equipment.current,      // 当前手持（显示太阳色小圆点）
    onSelect: ( id ) => equipment.set( id ),
    codes: codesOf( 'equipment' ),         // 打开 / 打开后顺时针切换
    closeCodes: [ …移动键 ],               // 按下即关闭、不切换，按键继续传给游戏
    canOpen: () => true,                   // false 不打开；返回 i18n key 则弹出该提示
  } );
  ```
  打开时屏幕轻微暗化；鼠标移动驱动虚拟光标（不释放指针锁），死区外按角度选扇区；左键或 Enter 确认；
  轮盘打开期间吞掉鼠标和它自己的按键，镜头不转、鱼竿不会误抛。语言切换时文字即时更新。
- `src/core/Equipment.js`：`ItemRegistry` + `Equipment`。`app.equipment` 在 `App` 构造时创建，内置"空手"（id `hands`，默认）。
  `Equipment.set( id )` 先 `unequip` 当前装备再 `equip` 新装备，任意时刻只有一件；当前装备 `busy()` 时拒绝切换（搏鱼中、渔获卡片中）；
  每帧 `Equipment.update()`：当前装备不再可用（游泳、开船、自由相机、钓鱼关闭）时静默收起、回到空手。
- 鱼竿在 `src/game/Game.js` 构造函数里注册，复用上游的 `rod.equip()` / `cancelLine()`，钓鱼逻辑本身没改，只改了入口。

### 新增一个装备项（例如滑翔伞）

1. 在合适的模块里：
   ```js
   app.equipment.registry.add( {
     id: 'glider', label: 'equip.glider', hint: 'equip.gliderHint', icon: 'glider', order: 20,
     visible: () => Options.get( 'gliding' ),   // 可选：不满足就不出现在轮盘上
     available: () => player.mode === 'walk',   // 可选：不满足就灰显、不能选
     unavailableHint: 'equip.gliderUnavailable', // 可选
     busy: () => glider.inFlight,               // 可选：飞行中不能收起
     equip: () => glider.show(), unequip: ( { silent } ) => glider.hide(),
   } );
   ```
2. `src/ui/icons.js` 的 `PATHS` 加 `glider` 图标（24×24 描边）。
3. 五个语言文件都加 `equip.glider` / `equip.gliderHint`（以及 unavailableHint），跑 `npm run i18n:check`。
4. 不需要改轮盘、不需要新键位。

## 玩法选项（设置 H → 玩法 → 玩法选项）

`src/core/Options.js`：`Options.define( { id, label, tip, value } )` / `get` / `set` / `list` / `onChange`，保存在
`localStorage['tidewater.options']`。`AppUI.js` 按 `Options.list()` 自动生成开关，所以加"冲浪玩法"只需：
一行 `Options.define( { id: 'surfing', label: 'options.surfing', tip: 'options.surfingTip', value: false } )`，
五个语言补 `options.surfing` / `options.surfingTip`，代码里 `Options.get( 'surfing' )` / `Options.onChange`。

| 开关 | 默认 | 关闭后 |
|---|---|---|
| 钓鱼玩法 `fishing` | 开 | 轮盘里没有鱼竿（已拿着的会收起），钱包 / 冷藏箱 / 油量 / 声呐 HUD 隐藏，I/Tab 无效，与乔 / 玛尔塔交谈和交易隐藏，小地图上的商贩标记和鱼群点隐藏，钓鱼相关提示不出现，帮助页的钓鱼行隐藏，**开船不耗油**（否则没油又买不到） |
| 小地图 `minimap` | 开 | 小地图隐藏且不再每帧更新 |
| 轻量 HUD `lightHud` | 关 | 打开后隐藏帧率面板、品牌与模式标签、提示卡片；交互提示、通知、船只仪表、深度计保留 |
| 概览与提示 `guide` | 开 | 不再弹出首次概览和一次性提示 |

钓鱼 HUD（钱、冷藏箱）只在鱼竿拿在手上（或冷藏箱 / 商店面板打开）时显示；船上的油量和声呐在钓鱼开启且在船上时显示。

## 阶段记录

### 阶段：换底座，保住多语言（2026-10-27，分支 `main-v2`）

已完成：
- 备份分支 `backup-fork-old`；添加 `upstream` 远端；`main-v2` 从 `upstream/main` 建立。
- 多语言改为按语言分文件（`src/ui/locales/*.js`，398 个 key × 5 种语言），新运行时 `src/ui/i18n.js`。
- 旧 fork 的设置面板翻译（约 90 条）全部沿用；补了上游新增的设置项（抗锯齿、渲染比例说明等）。
- 上游新增界面全部接入：钓鱼 HUD（钱包、冷藏箱 / 鱼舱、油量、声呐、搏鱼提示）、渔获卡片、冷藏箱与鱼类图鉴、鱼摊、船具店、
  新手引导 3 张卡与 8 条提示（含实时方位"西南方 4 米"）、小地图"北"、帮助页、开始画面、加载器（状态、提示轮播、错误信息、WebGPU 不可用提示）、
  HUD 模式标签、交互提示与按键名（左键 / 右键 / 空格）、船速表（节、转速、航向方位）、深度计。
- 18 种鱼中文通行名；中文单位公斤 / 厘米 / 米 / 升（英寸 / 磅作为副单位）。
- 缺 key 回退英文 + 控制台警告；选择持久化；中文浏览器默认中文。
- `npm run i18n:check`（并入 `npm test`）、`test/i18n.test.mjs`（运行时行为）、`npm run i18n:preview`（`test/i18n.html`）。
- `test/engine-smoke.mjs` 的截图改写到系统临时目录（原来硬编码 `/tmp`，Windows 上失败）。
- README：演示链接指向本 fork，补多语言说明；`.github/workflows/deploy.yml` 保持不变（push 到 main 自动部署 Pages）。

待办 / 留到后续阶段：
- **阶段五**：日 / 韩 / 阿语深度打磨（现在是可用翻译，鱼名多为音译；阿语只对部分容器做了 RTL）。
- 文案定位：上游的加载器副标题、引导欢迎卡、帮助页"钓鱼玩法"段落是以钓鱼为中心的写法，已忠实翻译；
  与"个人私密世界"定位的调整（例如加载器副标题改为探索向）需要另行决定。
- `UI.demo()`（上游的开发用示例面板，游戏里不调用）没有接入多语言，`i18n:check` 有意跳过它。
- 渔获卡片打开时切换语言会重绘文字，倒计时条会重新开始（无功能影响）。
- 时间滑块的 `aria-valuetext`（读屏用）在切换语言后要等时间值变化才会更新。
- 店铺 / 摊位 3D 模型上的招牌是贴图，不在多语言范围内。
- 首次打开时加载器会先闪现一瞬间英文（脚本模块执行前），之后立即变成所选语言。

验证情况：
- 已验证：`npm run build`、`npm test`（i18n 检查、运行时测试、钓鱼逻辑、Node 无头 WebGPU 引擎冒烟）通过；
  `test/i18n.html` 在浏览器里逐屏脚本检查，中文下可见文字除 `fps`、品牌名 TIDEWATER、单位 km/EV/ms 外无英文残留；阿语面板方向为 RTL。
- 本机内置浏览器（Chromium，localhost 下有 WebGPU）实际跑通了完整游戏：中文加载器到"准备就绪"、新手引导（含实时方位）、
  模式标签、R 拿竿吐司与提示、I 冷藏箱、渔获卡片（实时 3D 鱼）、卖鱼吐司、运行中切换 中→英→中 并写入 localStorage、无 i18n 警告。
  注意：当时浏览器窗口被遮挡，rAF 不触发，测试时在页面里把 rAF 换成了 setTimeout 才能推进帧；真实的鼠标抛竿 / 搏鱼 / 走到摊位前交易没有手动操作过。

### 阶段：键位整理、装备轮盘、玩法选项（2026-10-27，分支 `main-v2`）

已完成：
- 键位审计（结果见上方键位表）；键位注册表 `src/core/Keymap.js`，F1 帮助页由它自动生成；去掉 Q、左 Ctrl、自由相机里的 E 这三个未登记的别名。
- 通用轮盘 `src/ui/RadialWheel.js` + 装备注册表 `src/core/Equipment.js`；R 打开装备轮盘，"空手"为默认，鱼竿并入轮盘。
- 钓鱼 HUD 只在鱼竿装备时显示。
- 玩法选项 `src/core/Options.js`：钓鱼玩法、小地图、轻量 HUD、概览与提示，可单独开关并持久保存。
- 新手引导改为一张"这里可以做什么"概览（时间 / 太阳 / 海浪、游泳潜水、开船、自由相机、拍照、装备轮盘），钓鱼只是其中一项，
  可在设置里关闭；老用户（看过旧引导）也会看到一次新概览。
- 加载器副标题和提示轮播改为以探索为主（R 的含义变了，旧提示已不正确）；帮助页底部文字按钓鱼开关切换。
- 新增 `test/keymap.test.mjs`（并入 `npm test`）；`i18n:check` 现在也检查代码里所有形如 `'equip.rod'` 的 key、注册表与选项的 key。
- 多语言：本阶段新增 / 改写的文字全部补齐 5 种语言（共 413 个 key），删除了不再使用的旧引导 / 方位 / 帮助行 key。

验证情况：
- 已验证：`npm run build`、`npm test` 通过。`test/i18n.html` 中文下检查了自动生成的帮助页、轮盘、概览、玩法选项页。
- 在本机内置浏览器（有 WebGPU）里跑真实游戏并用脚本发送按键 / 鼠标事件验证：R 打开轮盘、R 切换、Enter 装备鱼竿（提示、HUD 出现）、
  W 关闭不切换、鼠标移到扇区 + 左键选回空手且左键没有误触抛竿、I / Tab、T / L / M / F、F1 帮助随钓鱼开关变化；
  通过设置面板的真实开关关闭钓鱼（鱼竿收起、轮盘只剩空手、I 无效、商贩标记隐藏、帮助行隐藏）、轻量 HUD、小地图，并确认写入 localStorage；
  W 能正常行走。截图确认了轮盘外观。
- 未验证：真实的指针锁定下的虚拟光标手感（测试时窗口被遮挡，用的是未锁定指针的绝对坐标路径）、真人鼠标抛竿 / 搏鱼、
  手柄 / 触控板（不在本阶段范围）。

注意：`?bench` 是上游的性能测试模式，载入后**不会启动游戏循环**（由 Bench 自己驱动帧），所以在 `?bench` 下无法走动是预期行为；
正常试玩请用不带参数的地址（`npm run dev` → http://127.0.0.1:5189/，或 `npm run build` 后 `npx vite preview`）。

线上站点：`origin/main` 仍是旧版（`d9fcc35`），https://zzzhengqi.github.io/tidewater/ 不受影响；本地 `main` 也已退回与线上一致。
新版在 `main-v2`，等新版做完再决定是否覆盖（需要强制推送，届时先确认）。

待办：
- 阶段五：日 / 韩 / 阿语的深度打磨（本阶段新增文字也是可用翻译）。
- 第二个轮盘（相机轮盘）尚未实现，接口已就绪。
- 轮盘目前只支持鼠标键盘。
