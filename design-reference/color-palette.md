# Overthought — Color Palette

Source extracted from the current live design system. This palette should be treated as the source of truth for colors and gradients used in the app UI.

## Primary brand colors

| Color | Hex | Usage |
|---|---|---|
| Brand Pink | `#F2228E` | Primary CTAs, ring/focus, hero gradient start, high verdict |
| Brand Purple | `#A833E6` | Hero gradient mid-stop, clown verdict tier |
| Brand Lilac | `#8B5CF6` | Secondary buttons, hero gradient end |
| Ink | `#1F1722` | Headings, body copy, strong outlines, active nav |
| Cream | `#F6F0E2` | App background, off-white canvas |

## Accent colors

| Color | Hex | Usage |
|---|---|---|
| Acid Lime | `#D2F73D` | Accent pops, badge highlights, acid gradient start |
| Chill Teal | `#1FD7B0` | Acid gradient end, low verdict tier, mint score card |
| Warm Orange | `#FBA82A` | Mid verdict tier, premium warm tone |
| Primary Glow | `#FB6CF1` | Radial halo behind hero, glow accents |
| Soft Cream Grey | `#EAE3D2` | Muted surfaces, soft chips |
| Lavender Grey | `#5B576E` | Secondary copy, meta text |
| Cream Tint | `#F0E9D7` | Cream gradient lower stop |

## Semantic UI colors

| Token | Hex | Usage |
|---|---|---|
| Primary background | `#F2228E` | Primary button background |
| Primary foreground | `#FFFFFF` | Primary button text |
| Secondary background | `#8B5CF6` | Secondary button background |
| Secondary foreground | `#FFFFFF` | Secondary button text |
| Accent background | `#D2F73D` | Accent chip / highlight |
| Accent foreground | `#1F1722` | Text on lime accent |
| Card background | `#FFFFFF` | Standard card surface |
| Card foreground | `#1F1722` | Card body text |
| Background | `#F6F0E2` | App canvas |
| Heading text | `#1F1722` | H1–H4 |
| Muted text | `#5B576E` | Secondary text |
| Inactive nav icon/text | `#5B576E` | Bottom nav inactive items |
| Border | `#E2DDEA` | Card borders, outlines |
| Divider | `#E2DDEA` | Separators |
| Input background | `#E2DDEA` | Input fill / outline |
| Placeholder text | `#5B576E` | Input placeholder |
| Destructive | `#EF4444` | Errors, delete |
| Ring | `#F2228E` | Focus ring |

## Gradient definitions

| Name | Direction | Colors | Usage |
|---|---|---|---|
| Hero | `135deg` | `#F2228E` → `#A833E6` → `#8B5CF6` | Welcome hero card, primary brand surface |
| Acid | `135deg` | `#D2F73D` → `#1FD7B0` | Accent badges, low-score callouts |
| Clown | `135deg` | `#F2228E` → `#FBA82A` | Premium / clown-tier highlight |
| Cream | `180deg` | `#F6F0E2` → `#F0E9D7` | Subtle background wash |
| Chrome | `180deg` | `#FFFFFF` → `#E2DDEA` | Soft elevated surface |
| Glow | `radial` | `rgba(251,108,241,0.35)` → `transparent` | Halo behind hero/score |

## Verdict / score mapping

| Tier | Hex | Suggested range |
|---|---|---|
| Low delusion | `#1FD7B0` | 0–25 |
| Medium delusion | `#FBA82A` | 26–55 |
| High delusion | `#F2228E` | 56–80 |
| Very high / clown | `#A833E6` | 81–100 |

Use 15% opacity background with the solid tier color for soft score cards and pills.

## Compact design tokens

```json
{
  "color": {
    "bg": {
      "base": "#F6F0E2",
      "surface": "#FFFFFF",
      "muted": "#EAE3D2",
      "elevated": "#FFFFFF"
    },
    "text": {
      "primary": "#1F1722",
      "secondary": "#5B576E",
      "muted": "#5B576E",
      "onBrand": "#FFFFFF",
      "onAccent": "#1F1722"
    },
    "brand": {
      "pink": "#F2228E",
      "purple": "#A833E6",
      "lilac": "#8B5CF6",
      "ink": "#1F1722",
      "cream": "#F6F0E2"
    },
    "accent": {
      "lime": "#D2F73D",
      "mint": "#1FD7B0",
      "orange": "#FBA82A",
      "glow": "#FB6CF1"
    },
    "ui": {
      "border": "#E2DDEA",
      "divider": "#E2DDEA",
      "input": "#E2DDEA",
      "ring": "#F2228E",
      "placeholder": "#5B576E",
      "destructive": "#EF4444"
    },
    "verdict": {
      "low": "#1FD7B0",
      "mid": "#FBA82A",
      "high": "#F2228E",
      "clown": "#A833E6"
    },
    "gradient": {
      "hero": "linear-gradient(135deg, #F2228E 0%, #A833E6 50%, #8B5CF6 100%)",
      "acid": "linear-gradient(135deg, #D2F73D 0%, #1FD7B0 100%)",
      "clown": "linear-gradient(135deg, #F2228E 0%, #FBA82A 100%)",
      "cream": "linear-gradient(180deg, #F6F0E2 0%, #F0E9D7 100%)",
      "chrome": "linear-gradient(180deg, #FFFFFF 0%, #E2DDEA 100%)",
      "glow": "radial-gradient(circle at 50% 0%, rgba(251,108,241,0.35) 0%, transparent 70%)"
    }
  }
}
```

## Notes for Codex

- Treat this file as the source of truth for Overthought colors and gradients.
- Do not invent a new palette.
- Match the current Overthought identity:
  - cream background
  - ink text
  - hot pink / purple gradients
  - restrained lime accent
  - thick outlines
  - playful but polished iOS-first UI
- Keep gradients restrained. Neutral surfaces should still do most of the work.
