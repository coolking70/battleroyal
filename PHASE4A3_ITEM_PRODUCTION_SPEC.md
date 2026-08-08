# Phase 4A-3 Item Production Specification

## Scope

This phase validates repeatable item production against the existing repository definitions. It does not create item tasks or change recipes, damage, armor, healing, durability, craft costs or loot tables.

## Shared contract

Every B3 task uses `item-positive-only` with:

- one complete isolated object;
- centered or deliberately slight-diagonal presentation;
- plain dark-gray studio backdrop;
- strong silhouette and small inventory-size readability;
- empty `negativePrompt`;
- no UI, scene, person or wearer semantic injection.

## Category policy

| Category | Positive presentation | Category-specific audit |
| --- | --- | --- |
| Consumable | single isolated consumable object | no person, scene or UI pollution |
| Material | single crafting-material subject | no scene, UI, tool, weapon or armor transformation |
| Weapon | weapon alone as an isolated object | weapon identity allowed; no character or battle scene |
| Armor | protective equipment alone | no wearer or mannequin composition |

## B3 inventory

The existing repository contains exactly eight ungenerated tasks: Battery, Iron, Wood, Iron Pipe, Stone Axe, Simple Bow, Simple Armor and Plate Armor. They run in material ×3, weapon ×3, armor ×2 order, once each, with concurrency 1.

All results remain pending until human review. No B3 candidate is eligible for formal publication in this phase.
