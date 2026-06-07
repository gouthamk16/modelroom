---
name: Precision Radiance
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#57423d'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#8b716b'
  outline-variant: '#dec0b9'
  surface-tint: '#a63b21'
  primary: '#a63b21'
  on-primary: '#ffffff'
  primary-container: '#e86b4d'
  on-primary-container: '#560d00'
  inverse-primary: '#ffb4a3'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e5e2e1'
  on-secondary-container: '#656464'
  tertiary: '#5d5e60'
  on-tertiary: '#ffffff'
  tertiary-container: '#909193'
  on-tertiary-container: '#282a2c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad2'
  primary-fixed-dim: '#ffb4a3'
  on-primary-fixed: '#3d0700'
  on-primary-fixed-variant: '#85230b'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e2e2e4'
  tertiary-fixed-dim: '#c6c6c8'
  on-tertiary-fixed: '#1a1c1d'
  on-tertiary-fixed-variant: '#454749'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
This design system embodies a sophisticated, "Instrument-Grade" precision within a light-mode environment. It is tailored for high-performance SaaS and fintech applications where clarity and data density must coexist with a premium, approachable feel. 

The aesthetic is a blend of **Minimalism** and **Tactile Modernism**. It prioritizes extreme legibility and structural order, utilizing significant white space to prevent cognitive overload. The emotional response is one of calm confidence, professional reliability, and modern efficiency. High-contrast accents in coral and deep black punctuate the neutral canvas, guiding the eye toward critical actions and data points with surgical intent.

## Colors
The palette is built upon a foundation of "Functional Neutrals" with high-energy "Precision Accents."

- **Primary (Coral):** Used sparingly for primary actions, success indicators, and key data highlights. It provides a warm, energetic contrast to the cool grays.
- **Secondary (Deep Black):** Reserved for high-contrast text, iconography, and primary buttons. It provides the "ink" that gives the UI its authoritative weight.
- **Tertiary (Surface):** An off-white/very light gray used for the main background to reduce eye strain compared to pure white (#FFFFFF).
- **Functional Grays:** A spectrum of grays used for borders, secondary text, and iconography to create a clear information hierarchy.

## Typography
The system utilizes **Manrope** across all levels to maintain a clean, geometric, and modern look that feels both technical and friendly.

Headlines use tighter letter-spacing and semi-bold weights to command attention without feeling "heavy." Body text is optimized for readability with generous line heights. Labels utilize uppercase styling and increased tracking for metadata and category headers, mimicking the precision labels found on high-end industrial instruments.

## Layout & Spacing
The layout follows a **Fluid Grid** philosophy within a structured container. A 12-column grid is used for desktop views, transitioning to a 4-column grid for mobile devices.

Spacing is based on a **4px baseline grid**, ensuring mathematical precision in alignment. Components are grouped using "Logical Clustering," where related items share tighter internal spacing (`xs` or `sm`) while major sections are separated by `lg` or `xl` tokens to create a breathable, airy interface. 

- **Desktop:** 40px outer margins with 24px gutters.
- **Tablet:** 24px outer margins with 16px gutters.
- **Mobile:** 16px outer margins with 12px gutters.

## Elevation & Depth
Hierarchy is established through **Ambient Shadows** and **Tonal Layering**. 

The background is a flat neutral surface. Components (cards) sit on this surface with a very subtle, diffused shadow (`0px 4px 20px rgba(0,0,0,0.04)`) and a whisper-thin light border (`1px solid #EDEDED`) to define their boundaries. This creates a "soft elevation" effect where elements appear to float slightly above the canvas without being disconnected.

Secondary interactive elements (like input fields or inactive chips) use a slightly recessed or flat treatment to remain lower in the visual stack than primary cards.

## Shapes
The shape language is defined by **pronounced roundedness**, which softens the "instrumental" precision to make the UI feel modern and approachable. 

Primary containers and cards use a `24px` (extra-large) radius to create a friendly, "pill-like" architecture. Buttons and smaller input fields use a `12px` or `16px` radius. This consistent curvature across the UI creates a unified visual rhythm that feels cohesive and intentional.

## Components
- **Buttons:** Primary buttons are either deep black with white text or coral with white text, featuring 16px corner radii. Secondary buttons use a light gray ghost style with a subtle border.
- **Cards:** The hallmark of the system. Cards feature white backgrounds, 24px corner radii, and soft ambient shadows. Internal padding is generous (minimum 24px).
- **Input Fields:** Clean, minimal fields with a light gray background and a subtle 1px border. Focus states are indicated by a 2px coral ring.
- **Chips/Badges:** Small, high-radius (pill-shaped) elements used for status or filtering. They use light tonal backgrounds (e.g., light coral or light gray) with high-contrast text.
- **Data Visuals:** Charts use the coral primary color for the main data line/area, with deep black for axes and labels. Grid lines are kept at a very low opacity (10-15%) to maintain clarity.
- **Icons:** Thin-stroke (1.5px or 2px) monochrome icons. Coral is used only when the icon represents a specific state change or primary navigation anchor.