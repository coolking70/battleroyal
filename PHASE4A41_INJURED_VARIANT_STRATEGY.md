# Descriptor-Locked Text-Only Injured Variant Strategy

The current Agnes adapter is text-to-image only. Approved portrait bytes are not passed to the provider. “Same character” therefore cannot be technically guaranteed.

This phase uses an explicit descriptor-locked text-only variant as a controlled canary, not as a proven identity-consistency solution. The provider request uses only the existing contract fields: `model`, `prompt`, `size`, `ratio` and `return_base64`. No reference image, image edit, img2img or identity-reference capability is assumed or added.

The Scout canary locks age range, hair, jacket, shirt, trousers, binoculars, neck strap, side pouch and civilian observer identity. It changes only mild fatigue, dust, a minor scuff, a small beige adhesive bandage and a slightly tense expression. The canary is positive-only with an empty negative prompt.

A successful technical generation does not prove viability. The candidate remains pending until the user compares it beside the official Scout portrait. If the user approves identity consistency, the remaining three injured variants may be considered in Phase 4A-4.2. If rejected, the text-only variant route stops and reference-capable or image-editing options must be researched instead.
