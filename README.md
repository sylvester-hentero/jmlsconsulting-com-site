# JMLS Consulting Inc. (`jmlsconsulting.com`)

Official website for **JMLS Consulting Inc.** — Fractional & Interim CFO Advisory led by **John Scalise, CPA, CGA**.

## Architecture & Highlights
- **Design System**: Editorial C-suite financial advisory aesthetic featuring Deep Ocean Navy (`#053652`), Warm Burnished Gold (`#C5853B`), and Alabaster White (`#FFFFFF`) paired with *Cormorant Garamond* and *Plus Jakarta Sans*.
- **Modern Web Platform Capabilities**:
  - Responsive Popover Navigation (`popover="auto"` + `ResizeObserver` inline fit measurement + conditional `@oddbird/popover-polyfill` fallback)
  - Scroll-Driven Shrinking Header (`animation-timeline: scroll(block root)` with `@supports` and JS scroll fallback)
  - Native `<details>` & `::details-content` Accordions with custom CSS mask markers and Invoker Commands (`command="--toggle-all"`)
  - Progressive `:user-invalid` Form Validation synchronized with `aria-invalid`, dynamic `aria-describedby`, and a polite ARIA live announcer
  - LCP Image Priority Optimization (`fetchpriority="high"` on the hero image; native `loading="lazy"` on below-the-fold photography)
- **Cloudflare Pages Function**: `POST /api/contact` (`functions/api/contact.js`) handling discovery session inquiries for `info@jmlsconsulting.com`.

## Deployment
Hosted on **Cloudflare Pages** (`jmlsconsulting-com-site.pages.dev`) and connected to custom domains `jmlsconsulting.com` and `www.jmlsconsulting.com`.
