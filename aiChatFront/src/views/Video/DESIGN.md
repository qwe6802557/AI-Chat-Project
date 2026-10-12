# Design System: AI Video Workbench (视频创作工坊)

## 1. Visual Theme & Atmosphere
- **Mood**: A focused, studio-grade creative workbench blending gallery minimalism with precise media control. The aesthetic is clean, cinematic, and restrained — eliminating clutter while highlighting generated moving visual assets.
- **Density**: 4 (Daily App Balanced) — generous breathing room for media previews, balanced spacing for inputs, avoiding over-cramped dashboards.
- **Variance**: 5 (Offset Asymmetric Grid) — responsive masonry card stream paired with a bottom-anchored floating tactile control console.
- **Motion Intensity**: 6 (Fluid CSS with Micro-Springs) — silky hover previews, smooth 150ms state crossfades, breathing skeleton pulses.

## 2. Color Palette & Roles
- **Canvas Neutral** (`#F8FAFC`) — Primary application surface, perfectly matching Chat, Image, and Voice workbenches.
- **Card Surface** (`#FFFFFF`) — High-elevation video cards with subtle 1px border.
- **Charcoal Ink** (`#0F172A`) — Primary display text, video titles, action anchors.
- **Slate Subdued** (`#64748B`) — Metadata, duration tags, timestamps, aspect ratio labels.
- **Whisper Border** (`#E2E8F0` / `rgba(226, 232, 240, 0.8)`) — 1px crisp structural division lines.
- **Brand Electric Violet Accent** (`#6366F1`) — Controlled, singular accent for primary buttons, generation progress rings, and active states. Saturation < 75%.
- **Success Emerald** (`#10B981`) — Completed badge & high-fidelity playback indicator.
- **Warning Amber** (`#F59E0B`) — Processing and queued status indicators.
- **Banned**: Multi-color neon gradients, AI purple outer glows, oversaturated buttons, pure pitch black (`#000000`).

## 3. Typography Rules
- **Display / Headers**: Track-tight (-0.02em), bold 600 weight, Sans-Serif system typography. No loud screaming type.
- **Body**: Relaxed leading (1.5), 14px default, slate muted secondary descriptions.
- **Mono / Metrics**: Numbers, elapsed seconds, resolutions (720P/1080P), and credit costs (`200 积分`) use monospace font family for zero layout jitter.
- **Banned**: Inter in decorative hero headlines, generic Times New Roman, italic AI marketing slogans.

## 4. Component Stylings
- **Video Cards (`VideoCard.vue`)**:
  - Border-radius: `16px` (`1rem`).
  - Shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.05)` elevating to `0 12px 28px -4px rgba(15, 23, 42, 0.12)` on hover.
  - Hover Action: Auto-silent loop video micro-preview (muted preview playback on hover) with play overlay button.
  - No physical negative Y displacement (`translateY`) to prevent viewport jitter.
- **Floating Control Bar (`VideoControlBar.vue`)**:
  - Sticky bottom floating bar with frosted glass backdrop (`backdrop-filter: blur(16px)`).
  - Integrated text area with dynamic pill toggles: [📷 参考图上传/选择] + [📐 比例 16:9 / 9:16] + [⚡ 200 积分].
- **Loaders & Progress**:
  - Shimmering skeletal video placeholder with elapsed second counter (`00:42`) and soft breathing ring. No cheap spinning wheels.
- **Modal Player (`VideoPreviewModal.vue`)**:
  - Fullscreen/theater modal, dark cinema overlay (`rgba(15, 23, 42, 0.85)` with blur), featuring standard play/pause, loop, progress scrubber, and 1-click MP4 download.

## 5. Layout Principles
- **Layout Shell**: Perfectly fits within `MainLayout.vue` (`width: 100%; height: 100%; overflow: hidden;`), 0 tab flicker on switch.
- **Left Column**: Shared conversation & history sidebar (`Sidebar.vue`) for consistency.
- **Right Column**: Main video streaming viewport with smooth native scrolling, topped with empty state or masonry grid.
- **Single Column Collapse (< 768px)**: Seamless transition to single-column card stack on mobile.

## 6. Motion & Micro-Interactions
- **Active Controls**: 0.98 scale tactile push feedback on active button click.
- **Hover Transitions**: Smooth 200ms opacity and border color crossfade.
- **Performance**: Animations exclusively driven by GPU-accelerated `opacity` and `transform`.

## 7. Anti-Patterns (Explicitly Banned)
- ❌ No spinning wheel spinners — use time-counted progress bars and pulse cards.
- ❌ No neon purple glowing box-shadows.
- ❌ No layout jumping on hover.
- ❌ No generic "John Doe" or cliché copy ("Unleash AI magic").
- ❌ No broken external CDN video URLs — all completed videos must be stream-persisted to local server storage.
