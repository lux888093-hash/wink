# Design System: The Sommelier’s Digital Cellar

## 1. Overview & Creative North Star

### Creative North Star: "The Digital Curator"
This design system is not a utility; it is an editorial experience. Inspired by the heritage of fine winemaking, the system moves away from the rigid, "app-like" grids of standard e-commerce. Instead, it adopts the persona of a **High-End Digital Curator**. 

The aesthetic is built on **Tonal Depth** and **Asymmetric Elegance**. By utilizing high-contrast typography scales and overlapping imagery, we break the "template" look. Surfaces are treated as physical layers—leather, parchment, and aged oak—translated through sophisticated dark mode tokens. The goal is to make the user feel as though they are flipping through a bespoke vintage wine journal rather than navigating a mini-program.

---

## 2. Colors

The palette is anchored in a sophisticated dark theme, utilizing deep burgundy (`primary_container`), burnished gold (`secondary`), and charcoal neutrals.

### The "No-Line" Rule
**Explicit Instruction:** Use of 1px solid borders for sectioning or containment is strictly prohibited. 
Structure must be defined through:
- **Background Color Shifts:** Use `surface_container_low` against `surface` to define a header area.
- **Tonal Transitions:** Use vertical spacing and distinct surface tiers to imply boundaries.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers. 
- **Base Layer:** `surface` (#131313) for the main background.
- **Content Cards:** `surface_container_low` or `surface_container_lowest` for deep, recessed sections.
- **Interactive Elements:** Elevated components use `surface_bright` to "lift" off the page.

### The "Glass & Gradient" Rule
To escape the "flat" look, utilize `surface_variant` with 60-80% opacity and a `backdrop-blur` (12px-20px) for floating navigation bars or modal overlays. 
- **Signature Polish:** Use a subtle linear gradient for primary CTAs, transitioning from `primary` (#ffb4a8) to `primary_container` (#520000) at a 135-degree angle. This provides a "velvet" texture that solid colors cannot replicate.

---

## 3. Typography

The typography strategy relies on the tension between a high-character Serif and a technical, clean Sans-Serif.

*   **Display & Headlines (Newsreader):** Use for wine names, vintage years, and tasting note titles. The serif choice conveys heritage, authority, and the artisanal nature of the product.
*   **Body & Labels (Manrope):** Use for technical specs (ABV, Region, Grape Type). The sans-serif provides the "modern sommelier" balance—efficient, readable, and precise.

**Hierarchy as Identity:** 
- Use `display-lg` for hero product names to create an editorial "wow" factor.
- Use `label-sm` with increased letter-spacing (0.05em) for secondary metadata to mimic the fine print on a premium wine label.

---

## 4. Elevation & Depth

We eschew traditional drop shadows in favor of **Tonal Layering** and **Ambient Light**.

*   **The Layering Principle:** Place a `surface_container_highest` card on a `surface` background. The subtle shift in grey-value provides enough contrast to signify a new depth level without visual noise.
*   **Ambient Shadows:** If a floating action button (FAB) or high-priority modal requires a shadow, use a custom shadow: 
    - `Box-shadow: 0px 24px 48px rgba(0, 0, 0, 0.4);` 
    - Never use pure black shadows; if the surface is burgundy, the shadow should be a dark, desaturated version of that hue to mimic natural light absorption.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` at **15% opacity**. It should feel like a suggestion of an edge, not a hard line.
*   **Glassmorphism:** Use semi-transparent `surface_container_high` (80% opacity) with a background blur for tasting note overlays. This allows the rich textures of bottle photography to bleed through, integrating the UI with the content.

---

## 5. Components

### Buttons
- **Primary:** A gradient-filled container (`primary` to `primary_container`) with `on_primary_fixed` text. Roundedness: `md` (0.375rem).
- **Secondary:** An "Outline" style using the **Ghost Border** (20% opacity `outline`). 

### Cards (The "Sommelier" Card)
- **Prohibition:** No divider lines.
- **Style:** Use `surface_container_low` for the card body. Use `title-md` for the wine name and `label-md` in `secondary` (gold) for the price or vintage.
- **Layout:** Intentional asymmetry. Align text to the left, but allow product imagery to "break the container" by slightly overlapping the top or side edge.

### Tasting Note Chips
- Use `secondary_container` with `on_secondary_container` text. These should feel like small wax seals or labels. Roundedness: `full`.

### Input Fields
- **Background:** `surface_container_lowest`.
- **Focus State:** No thick border. Use a subtle glow effect (1px `outline` at 50% opacity) and transition the label color to `secondary` (gold).

### Additional Component: The "Heritage Timeline"
For displaying wine aging or history, use a vertical line in `outline_variant` (10% opacity) with small `secondary` (gold) dots. This adds a sense of "time" and "craft."

---

## 6. Do's and Don'ts

### Do
- **DO** use generous white space (specifically `1.5rem` to `2rem` between sections) to give the editorial content room to breathe.
- **DO** use "Newsreader" in italics for quotes or descriptions of "palate" and "finish."
- **DO** use imagery with high contrast and deep shadows to match the dark theme tokens.

### Don't
- **DON'T** use 100% white (#FFFFFF) for text. Always use `on_surface` (#e5e2e1) to reduce eye strain and maintain the "aged paper" feel.
- **DON'T** use standard Material Design "elevated" cards with heavy shadows. Use background color shifts instead.
- **DON'T** use vibrant, saturated "action" colors like bright blue or neon green. Stick strictly to the burgundy (`primary`) and gold (`secondary`) accents for all interactive feedback.
- **DON'T** use dividers. If content feels cluttered, increase the vertical margin (`spacing-xl`).