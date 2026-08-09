# Phase 4B-0 Accessibility Notes

This is a baseline planning note, not a WCAG certification.

- Safe/Warning/Restricted must always include text plus icon/pattern; color is
  never the only state channel.
- HP/Stamina bars must retain numeric values and a textual low/danger cue; a
  bar alone is insufficient.
- Search, move, craft, attack and skill disabled reasons should be visible in
  the action group or associated description. Current implementation often puts
  the reason only in `title` or a generic bottom hint.
- Add a global `:focus-visible` treatment in the polish phase. Current CSS only
  styles the seed input focus and removes its outline; buttons have no explicit
  keyboard-focus treatment.
- Maintain meaningful `alt` text for official art and fallback `aria-label` for
  emoji visuals. The existing `VisualImage` path is a good foundation.
- Target 44px touch controls in the mobile implementation; do not rely on the
  current 3–8px button padding for touch acceptance.
- Use a reduced-motion media query for event banners, bar pulses and future
  scene transitions.
- Keep Debug details outside the normal player hierarchy and avoid exposing
  debug/NPC hidden data in the formal UI.
- Test keyboard traversal, screen-reader labels, contrast over each Zone
  Background, and phone landscape/portrait in Phase 4B-6.
