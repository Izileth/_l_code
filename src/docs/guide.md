# LYRIC STUDIO — COMPLETE VISUAL REDESIGN

## 1. ROLE AND OBJECTIVE

Act as a senior Creative Director, Award-Winning Digital Product Designer, UI/UX Architect and Senior Frontend Engineer.

Your task is to completely redesign the existing **Lyric Studio** application, transforming its current interface into a premium, sophisticated and visually distinctive digital product.

The visual direction must be inspired by the provided reference image, which represents a contemporary editorial design language characterized by minimalist brutalism, monochromatic compositions, expressive typography and sophisticated spatial organization.

This is NOT a request to create a new application.

This is a visual and experiential redesign of an existing functional MVP.

The result must look like a carefully art-directed commercial product, not a generic AI-generated dashboard.

---

## 2. CORE DESIGN PHILOSOPHY

Adopt the following visual characteristics:

- Contemporary editorial minimalism.
- Modernist and minimalist brutalist influences.
- Monochromatic visual identity.
- High-contrast typography.
- Strong visual hierarchy.
- Generous negative space.
- Asymmetrical compositions.
- Sophisticated image treatments.
- Restrained interface elements.
- Precise alignment and consistent proportions.

The interface should communicate creativity, precision, technology and artistic identity.

Avoid excessive decoration. Every element must have a clear visual or functional purpose.

---

## 3. VISUAL IDENTITY

### Color Palette

Establish a strictly controlled monochromatic palette.

Suggested colors:

- Primary background: #080808
- Secondary background: #111111
- Surface background: #171717
- Elevated surface: #202020
- Primary text: #F2F2F2
- Secondary text: #929292
- Muted text: #626262
- Borders: #303030
- Accent: #F2F2F2

Avoid excessive gradients, colorful backgrounds, neon effects and unnecessary decorative colors.

The interface should rely primarily on contrast, typography, spacing and composition.

### Typography

Use a sophisticated contemporary sans-serif typeface.

Suggested fonts:
- Inter
- Geist
- Neue Montreal (if available)
- Helvetica Neue

Typography rules:

- Large editorial headings.
- Carefully controlled font weights.
- Tight but readable letter spacing.
- Small uppercase section labels.
- Subtle secondary information.
- Consistent typographic hierarchy.

Use monospace typography specifically for lyrics, timestamps, code-like elements and technical information.

### Borders and Surfaces

- Thin and subtle borders.
- Restrained corner radii.
- Minimal shadows.
- Flat, carefully layered surfaces.
- Consistent spacing.
- Avoid excessive rounded cards and floating containers.

The interface should feel architectural rather than component-template driven.

---

## 4. APPLICATION LAYOUT

Redesign the entire Lyric Studio interface.

### A. Global Navigation

Create a refined navigation system.

Requirements:

- Minimal brand identification.
- Compact application navigation.
- Clear application identity.
- Discreet version information where appropriate.
- Export action positioned prominently but elegantly.
- Thin horizontal separators.

The navigation should not consume unnecessary vertical space.

### B. Main Workspace

Establish a sophisticated two-column editorial composition.

LEFT COLUMN — EDITING WORKSPACE

RIGHT COLUMN — LIVE PREVIEW

The editing workspace should occupy approximately 60–65% of the available content width.

The preview should occupy approximately 35–40%.

Maintain generous spacing between both columns.

Avoid visually overcrowding the workspace.

### C. Audio Section

Redesign the audio upload component.

Requirements:

- Minimalist file selection interface.
- Clear audio iconography.
- Prominent upload action.
- Supported formats displayed discreetly.
- Selected filename and audio status.
- Elegant drag-and-drop interaction, if supported.

Avoid conventional oversized upload cards.

### D. Music Metadata

Create an elegant metadata editing section.

Fields:

- Title
- Artist
- Year

Requirements:

- Clearly distinguish labels and values.
- Use subtle separators between fields.
- Preserve inline editing.
- Maintain visual consistency.
- Avoid unnecessary input borders and decorative backgrounds.

### E. Lyrics Editor

The lyrics editor is one of the application's most important components.

Give it an editorial text-editing appearance.

Requirements:

- Monospace typography.
- Comfortable line height.
- Generous internal spacing.
- Clear distinction between verses, choruses and other sections.
- Preserve multiline editing.
- Maintain the ability to import .LRC files.
- Provide appropriate focus and selection states.

The editor should feel like a professional creative writing environment.

Do not make it look like a generic textarea inside a dashboard card.

---

## 5. LIVE PREVIEW EXPERIENCE

The preview is a central element of Lyric Studio.

It must receive the same visual attention as the editing workspace.

### Preview Composition

Create a sophisticated vertical 9:16 presentation frame.

Requirements:

- Authentic vertical video proportions.
- Minimal interface surrounding the preview.
- Carefully controlled background.
- Elegant play/pause control.
- Discreet playback timeline.
- Accurate audio duration and current playback position.

The preview must visually communicate the final exported experience.

### Lyrics Visualization

Preserve the existing lyric visualization system.

Implement or maintain:

- Progressive lyric appearance.
- Synchronized text rendering.
- Smooth transitions.
- Appropriate typography.
- Controlled positioning.
- Readable contrast.

Do not introduce unnecessary visual effects.

The lyrics should remain the protagonist of the experience.

---

## 6. INTERACTIONS AND MOTION

Use restrained, purposeful motion.

Recommended interactions:

- Subtle hover transitions.
- Smooth button feedback.
- Elegant focus states.
- Progressive element appearance.
- Smooth preview transitions.
- Refined playback controls.
- Responsive transitions between layouts.

Animations must feel intentional and polished.

Avoid excessive motion, bouncing elements, exaggerated scaling and generic AI-generated animation patterns.

Respect reduced-motion preferences.

---

## 7. RESPONSIVE DESIGN

The application must work correctly across:

- Large desktop screens.
- Standard desktop screens.
- Tablets.
- Mobile devices.

Desktop:
Maintain the two-column workspace.

Tablet:
Adapt the proportions and spacing without compromising usability.

Mobile:
Reorganize the application into a vertically structured workspace.

The preview must remain accessible without making the editing experience cumbersome.

Do not simply shrink the desktop layout.

---

## 8. FUNCTIONAL PRESERVATION — CRITICAL

This is an existing MVP.

Before modifying anything:

1. Inspect the entire project structure.
2. Identify the current frontend framework.
3. Understand the existing component architecture.
4. Identify the application's state management.
5. Inspect audio handling and playback logic.
6. Inspect the lyric synchronization implementation.
7. Understand the export pipeline.
8. Identify all existing interactions and dependencies.

Preserve all existing functionality.

Specifically:

- Audio file upload.
- Supported audio formats.
- Audio playback.
- Audio synchronization.
- Music metadata editing.
- Lyrics editing.
- LRC file importing.
- Live preview.
- Playback controls.
- Timeline and duration.
- Video generation and export.
- Existing application state and event handling.

Do not replace functional implementations with visual placeholders.

Do not remove existing features.

Do not introduce mock functionality where real functionality already exists.

Do not rewrite the entire application unnecessarily.

Reuse existing components and dependencies whenever appropriate.

If a visual modification requires changing an existing component, preserve its original functional behavior.

---

## 9. CODE QUALITY

The implementation must follow professional frontend engineering standards.

Requirements:

- Reusable components.
- Consistent design tokens.
- Clean component architecture.
- Semantic HTML.
- Accessible controls.
- Proper keyboard interactions.
- Maintainable CSS.
- No unnecessary dependencies.
- No duplicated styling logic.
- No console errors.
- No broken interactions.

Avoid excessive abstractions.

Do not introduce architectural complexity simply to achieve a visual result.

---

## 10. ANTI-VIBECODING REQUIREMENTS

This section is especially important.

The final interface must NOT exhibit the common characteristics of generic AI-generated websites.

Strictly avoid:

- Excessive rounded cards.
- Random gradient backgrounds.
- Unnecessary glowing effects.
- Generic dashboard layouts.
- Excessive floating elements.
- Inconsistent spacing.
- Random decorative icons.
- Oversized buttons without purpose.
- Unnecessary badges.
- Excessive use of glassmorphism.
- Repetitive card-based sections.
- Arbitr