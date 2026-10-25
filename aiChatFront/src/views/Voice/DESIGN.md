# Stitch Design Taste — Voice Workbench & Model Management Design System

## 1. Visual Atmosphere & Philosophy
- **Atmosphere**: Daily App Balanced (Density 5, Variance 4, Motion 6).
- **Design Philosophy**: High-clarity editorial software canvas. Clean surfaces with 1px whisper borders, generous spatial breathing room, and deliberate tactile feedback.
- **Surface Elevation**: Warm off-white canvas (`#F8FAFC`) with pure elevated white containers (`#FFFFFF`). Eliminates all jarring dark-slabs and neon glows in favor of calibrated neutral contrast.

---

## 2. Calibrated Palette
- **Canvas Base**: `#F8FAFC` (App background surface)
- **Container Pure**: `#FFFFFF` (Cards, drawers, modals, control bar)
- **Primary Ink**: `#0F172A` (Headlines, active states, key titles)
- **Body Charcoal**: `#334155` (Paragraphs, task text, table cells)
- **Muted Steel**: `#64748B` (Secondary descriptions, timestamps, subheadings)
- **Subtle Silver**: `#94A3B8` (Disabled states, placeholder text, borders)
- **Border Whisper**: `#E2E8F0` (Default 1px contours)
- **Border Active**: `#CBD5E1` (Hover contours)
- **Royal Accent**: `#2563EB` (Primary buttons, selected pills, brand badges)
- **Accent Soft**: `#EFF6FF` (Active pills, selected card background)
- **Provider Tags**:
  - `iFLYTEK / 科大讯飞`: Tag fill `#EFF6FF`, text `#1D4ED8`, border `#BFDBFE`
  - `Microsoft / 微软`: Tag fill `#F0FDF4`, text `#15803D`, border `#BBF7D0`
  - `Grok / xAI`: Tag fill `#F8FAFC`, text `#334155`, border `#E2E8F0`

---

## 3. Typographic Architecture
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Monospace Stack**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (For model IDs, latency ms, token numbers, audio timestamps)
- **Card Titles & Headers**: 13px - 14px, weight 600, track-tight (-0.01em)
- **Body Copy**: 13px, weight 400, line-height 1.6

---

## 4. Voice Workbench Component Behaviors
1. **Model Switcher Capsule**:
   - Encapsulated pill selector with clean provider badges.
   - Distinct models:
     - `微软 Edge 神经语音 (Edge-TTS)`: 31 款高可用神经音色（精品国语、方言、国际多语种）。
     - `科大讯飞高保真语音 (xfyun-tts)`: 5 大官方精品发音人（小燕、小露、许久、小婧、许小宝）。
     - `科大讯飞语音听写 (xfyun-iat)`: 高精度中英文流式识别引擎。
2. **Interactive Audio Cards**:
   - Clean card layout with waveform/progress bar, duration, volume control, download & replay buttons.
   - Status indicators: Success mint pill (`#ECFDF5` / `#10B981`), Processing blue pulse, Warning yellow banner.
3. **Foreign Voice Smart Tip**:
   - Inline warning pill with subtle amber tint (`#FFFBEB` background, `#D97706` text, `#FDE68A` border) alerting when pure foreign voices receive Chinese script.

---

## 5. AI Model Control Console (`ModelManageModal.vue`)
1. **Categorized Tabs**:
   - `全部`, `对话 (Chat)`, `图像 (Image)`, `视频 (Video)`, `语音 (Voice)`
2. **Tactile Switch Controls**:
   - Instant toggle of `isActive` with optimistic feedback and immediate propagation to frontend switcher.
3. **Real-time Latency Radar**:
   - Green pill: `< 800ms` (Fast / Healthy)
   - Yellow pill: `800ms - 2500ms` (Moderate)
   - Red pill: `> 2500ms` / Error (Slow / Degraded)

---

## 6. Anti-Patterns Banned
- No heavy purple/neon glowing shadows.
- No jarring black modal sheets in light mode.
- No generic spinning circular loaders — use skeleton wave bars or pulse pills.
- No unhandled code tracebacks in user-facing task cards.
