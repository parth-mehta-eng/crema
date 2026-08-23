# Crema Design Guide

## Vibe
Warm, premium, editorial, and calm—like a modern specialty café. The app should never look like an admin dashboard or a generic AI-generated interface.

## Typography
- **Cormorant Garamond SemiBold:** recipe names, hero headings, editorial section titles.
- **Inter:** navigation, buttons, metadata, labels, descriptions, and forms.
- Use serif sparingly so it remains special.

## Palette
| Token | Value | Use |
|---|---:|---|
| Background | `#F8F4EE` | Screen background |
| Surface | `#FFFDF9` | Cards and navigation |
| Espresso | `#3A2418` | Primary actions and brand anchor |
| Caramel | `#C8A67A` | Supporting accent |
| Iced Blue | `#DCECF8` | Gentle highlights |
| Sage | `#5F8A66` | Success and ingredient matches |
| Primary text | `#231A14` | Main text |
| Secondary text | `#6E625A` | Supporting copy |

## Spacing
Use only: `4, 8, 12, 16, 24, 32, 48`.

## Radius
- Buttons: 16
- Search: 18
- Cards: 20
- Modal/bottom sheet: 28
- Pills: fully rounded

## UI rules
- One primary CTA per screen or section.
- Photography carries the emotion; UI remains quiet.
- Use subtle shadows only on raised cards.
- Keep tab labels visible.
- Touch targets should be at least 44×44.
- New screens must reuse `Screen`, `AppText`, `DisplayText`, `RecipeCard`, `SearchBar`, and `CategoryChip` where appropriate.

## Avoid
- Neon gradients
- Glassmorphism
- Cartoon coffee art
- Random colors, radii, or shadows
- Dense dashboards
- More than two font families
- Multiple competing primary actions
