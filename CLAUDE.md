# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

番茄钟应用 — 浏览器端零依赖桌面工具，双击 `pomodoro/index.html` 即可使用。

## 架构

```
first-cc/
└── pomodoro/
    ├── index.html   # 主界面 + 内联 CSS
    └── app.js       # 计时器核心逻辑
```

### 计时器逻辑（app.js）

- **状态机**: `idle → running → paused`，运行中禁止切换模式
- **计时精度**: 用 `Date.now()` delta 而非 `setInterval` 累加，保证后台标签页切回后时间准确
- **SVG 进度环**: 通过 `stroke-dashoffset` 实现，周长为 `2 * π * 120`，由 JS 统一设置不依赖 CSS 硬编码
- **通知**: 用 Web Audio API 生成蜂鸣声，无外部音频文件
- **番茄周期**: 25min 专注 → 5min 短休息，每 4 个番茄为一轮（第 4 次休息为 15min 长休息）

### 关键约定

- 所有模式配置（时长、标签、主题色）集中在 `CONFIG` 对象，不分散在代码中
- `state.duration` 不存冗余，通过 `duration()` 从 `CONFIG` 实时推导
- UI 渲染分两条路径：`updateUI()` 完整渲染（模式切换、暂停、重置），`tickUI()` 轻量渲染（仅更新时间显示和进度环）

## 开发须知

- 零依赖、无构建步骤，任何修改后刷新浏览器即可看到效果
- CSS 的 `stroke-dasharray` / `stroke-dashoffset` 不要硬编码数值，由 JS 统一管理
- 不要添加持久化存储（localStorage 等）—— 刷新即重置是设计要求
