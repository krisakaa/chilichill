# @chili/assets

像素美术素材包。Web/App 两端共用同一套美术资源。

## 目录结构

```
packages/assets/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # 素材元数据声明（路径/尺寸/帧数/调色板）
    └── images/         # 实际 PNG 素材（美术交付后放这里）
```

## 美术需求

完整需求、命名规范、交付清单见项目根 **[docs/美术需求文档.md](../../docs/美术需求文档.md)**。
美术交付的 PNG 按文档命名放进 `src/images/`，文件名需与 `src/index.ts` 中 `NPC_SHEETS` / `MOODS_ASSETS` / `LOGO_ASSETS` 的 `path` 字段一致。

## 消费方式

```ts
import { NPC_SHEETS, PALETTE } from '@chili/assets';

const sheet = NPC_SHEETS.wave; // { path, frames, frameW, frameH, fps, loop }
// 在 drawNpc() 里按 frame index 从 spritesheet 截取对应帧绘制
```

> 当前 `images/` 为空，`@chili/ui` 的 `drawNpc()` 仍用占位 canvas 绘制。
> 美术素材到位后，替换 `drawNpc()` 内部实现读取 spritesheet 即可，对外 API 不变，全局生效。
