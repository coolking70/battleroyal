# Human Art Review Checklist

AI-generated candidates remain `pending` until a person chooses them. This checklist is guidance, not an automated approval signal.

## Character

- [ ] Character identity is immediately clear.
- [ ] Age, face, hairstyle, clothing, palette, and signature prop match the design sheet.
- [ ] Normal and injured variants are the same person.
- [ ] No extra limbs, malformed hands, text, watermark, logo, or commercial IP.
- [ ] Head and face are complete and the crop works in the UI.

## Zone

- [ ] Zone identity is obvious from architecture and props.
- [ ] No clear person falsely suggests a gameplay entity.
- [ ] Lower/center composition remains usable under overlays.
- [ ] No text, logo, watermark, or unreadable pseudo-signage.

## Item

- [ ] One object is centered and recognizable at 32–40px.
- [ ] Silhouette and material are clear.
- [ ] No hand, scene, label, logo, or text.

## World event

- [ ] Event theme is immediately legible.
- [ ] It does not reveal player coordinates or gameplay state.
- [ ] No commercial IP, battlefield escalation, monsterization, gore, text, or watermark.

## Decision

- [ ] Candidate hash recorded.
- [ ] Approve explicitly with `npm run art:approve ...`, or reject with a reason.
- [ ] Never approve a batch by assumption; review each selected candidate.
