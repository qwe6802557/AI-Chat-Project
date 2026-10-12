# Design System: AI-Chat-Project (Light Minimalist & Editorial Stitch)

## 1. Visual Theme & Atmosphere
- **Atmosphere**: Daily App Balanced (Density 5, Variance 4, Motion 5). A crisp, restrained, warm-gallery canvas with calm editorial structure and high visual clarity.
- **Canvas Mood**: Warm off-white surface (#F8FAFC) paired with pure white (#FFFFFF) elevated containers, subtle 1px whisper borders (#E2E8F0), and delicate neutral typography. Replaces heavy dark themes and dark slabs with airy, light modern software aesthetics that maintain 100% cohesion across Chat, Image Generation, Voice, and RAG Knowledge Base.

## 2. Color Palette & Roles
- **Canvas Light** (`#F8FAFC`) — Primary application background surface.
- **Pure Surface** (`#FFFFFF`) — Cards, table containers, sidebar, and elevated panel fill.
- **Slate Ink** (`#0F172A`) — Primary headlines, active tab text, and high-emphasis labels.
- **Body Charcoal** (`#1E293B`) — Body copy, table cell content, document names.
- **Muted Steel** (`#64748B`) — Secondary text, metadata, descriptions, empty state hints.
- **Subtle Silver** (`#94A3B8`) — Icons, placeholder text, tertiary captions.
- **Whisper Border** (`#E2E8F0`) — Card borders, dividers, 1px structural contours.
- **Whisper Sub-Border** (`#F1F5F9`) — Table rows, light inner partitions.
- **Royal Accent** (`#2563EB`) — Singular brand accent for primary CTAs, active status, and focus rings.
- **Accent Soft** (`#EFF6FF`) — Selected card background, active avatar container, rank tags.
- **Success Mint** (`#10B981` / Soft `#ECFDF5`) — Completed status badge, high-confidence score pill.
- **Danger Coral** (`#EF4444` / Soft `#FEF2F2`) — Deletion actions, failure badges.

## 3. Typography Rules
- **Display / Page Titles**: Track-tight (-0.02em), font-weight 600, `#0F172A`, 20px - 22px scale.
- **Section & Column Titles**: Font-weight 600, `#0F172A`, 13px - 14px scale.
- **Body Text**: Font-weight 400 - 500, `#1E293B` / `#334155`, line-height 1.5 - 1.6.
- **Monospace**: UI Monospace / SFMono-Regular / Menlo / Consolas for file sizes, chunk indexes, char counts, and raw chunks.
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.

## 4. Component Stylings
- **Buttons (`.stitch-btn`)**:
  - Primary: `#2563EB` fill, `#FFFFFF` text, 8px border-radius, subtle shadow `0 1px 2px rgba(37, 99, 235, 0.15)`. Hover: `#1D4ED8`, active: tactile `translateY(0)` / hover `translateY(-1px)`.
  - Icon Buttons: Transparent background, `#64748B` color, 6px border-radius, hover `#0F172A` with `#F1F5F9` background.
- **Navigation & Mode Switcher (`.mode-switcher`, `.tab-buttons`)**:
  - Encapsulated pill track: Background `#F1F5F9`, border-radius 20px, 3px inner padding.
  - Active Tab: `#FFFFFF` fill, `#0F172A` text, 16px border-radius, box-shadow `0 2px 6px rgba(0, 0, 0, 0.06)`, font-weight 500.
  - Inactive Tab: Transparent, `#64748B`, hover `#0F172A`.
- **Cards (`.kb-item-card`, `.result-item-card`)**:
  - Background `#FFFFFF`, border `1px solid #E2E8F0`, border-radius 10px - 12px, subtle shadow `0 1px 3px rgba(0, 0, 0, 0.02)`.
  - Hover: Border `#93C5FD`, background `#F8FAFC`, shadow `0 4px 12px rgba(0, 0, 0, 0.04)`.
  - Active: Border `#2563EB`, background `#EFF6FF`, shadow `0 2px 8px rgba(37, 99, 235, 0.08)`.
- **Upload Dropzone (`.upload-dropzone`)**:
  - Border: 2px dashed `#CBD5E1`, background `#F8FAFC`, 12px radius.
  - Dragging / Hover: Border `#2563EB`, background `#EFF6FF`.
- **Table Container (`.documents-table-wrapper`)**:
  - Clean white card `#FFFFFF`, border `1px solid #E2E8F0`, 10px radius, header background `#F8FAFC`, row divider `1px solid #F1F5F9`.
- **Search Input Row (`.search-input-row`)**:
  - `#FFFFFF` surface, border `1px solid #E2E8F0`, 10px radius. Focus-within: border `#2563EB`, glow ring `0 0 0 2px rgba(37, 99, 235, 0.1)`.

## 5. Layout Principles
- **Grid Architecture**: 2-column workbench layout (`320px 1fr`), max-width 1440px centered, 24px column gap.
- **Clean Spatial Zones**: Absolute element separation, no overlapping text/cards.
- **Responsive Collapse**: Below 992px, stack sidebar and detail columns into a single column.

## 6. Motion & Interaction
- **Transitions**: High-performance CSS transforms (`opacity`, `transform`, `border-color`, `background`).
- **Spring feel**: `cubic-bezier(0.16, 1, 0.3, 1)` easing for hover states.
- **Feedback**: Immediate visual response on tab clicks, drag enter/leave, and modal actions.

## 7. Anti-Patterns (Banned)
- No dark-mode jarring slabs (`#0b0f19` or dark navy) in the primary light workflow.
- No heavy purple/neon glowing shadows.
- No pure black (`#000000`) for text or surfaces.
- No low-contrast gray text on dark backgrounds.
- No jarring card jumps or border clipping on hover.
