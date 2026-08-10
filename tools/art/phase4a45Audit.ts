import fs from 'node:fs/promises';
import path from 'node:path';
import { CHARACTERS } from '../../src/data/characters';
import { ITEMS } from '../../src/data/items';
import { ZONES } from '../../src/data/zones';
import { WORLD_EVENT_IDS } from '../../src/core/worldEvents';
import { listCandidates } from './reviewer';
import { loadTasks } from './taskPlanner';
import { readManifest, readProvenance } from './publisher';
import { sha256Bytes } from './hash';
import { inspectImageBytes } from './validator';
import type { ArtConfig, ArtManifest, ArtTask, CandidateMetadata } from './types';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const CHARACTER_SLOTS = ['portrait', 'injured', 'combat'] as const;
const ZONE_SLOTS = ['background', 'warning', 'restricted'] as const;

export interface AssetFileAudit {
  taskId: string;
  manifestPath: string;
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  sha256: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  readable: boolean;
}

export interface Phase4A45AuditResult {
  generatedAt: string;
  phase: 'Phase 4A-4.5.1';
  passed: boolean;
  manifestCoverage: Record<string, unknown>;
  provenance: Record<string, unknown>;
  candidateHygiene: Record<string, unknown>;
  runtimeUsage: Record<string, unknown>;
}

export interface Phase4A45AuditOptions {
  publishedOnlyCi?: boolean;
}

function manifestPathForTask(manifest: ArtManifest, taskId: string): string | null {
  const [category, entityId, variant] = taskId.split('/');
  if (category === 'character') return manifest.characters[entityId!]?.[variant as (typeof CHARACTER_SLOTS)[number]] ?? null;
  if (category === 'zone') return manifest.zones[entityId!]?.[variant as (typeof ZONE_SLOTS)[number]] ?? null;
  if (category === 'item') return manifest.items[entityId!] ?? null;
  if (category === 'world_event') return manifest.worldEvents[entityId!] ?? null;
  return null;
}

function manifestEntries(manifest: ArtManifest): Array<{ taskId: string; publicPath: string }> {
  const entries: Array<{ taskId: string; publicPath: string }> = [];
  for (const [entityId, slots] of Object.entries(manifest.characters)) {
    for (const [slot, value] of Object.entries(slots)) if (typeof value === 'string') entries.push({ taskId: `character/${entityId}/${slot}`, publicPath: value });
  }
  for (const [entityId, slots] of Object.entries(manifest.zones)) {
    for (const [slot, value] of Object.entries(slots)) if (typeof value === 'string') entries.push({ taskId: `zone/${entityId}/${slot}`, publicPath: value });
  }
  for (const [entityId, value] of Object.entries(manifest.items)) if (typeof value === 'string') entries.push({ taskId: `item/${entityId}/icon`, publicPath: value });
  for (const [entityId, value] of Object.entries(manifest.worldEvents)) if (typeof value === 'string') entries.push({ taskId: `world_event/${entityId}/illustration`, publicPath: value });
  return entries;
}

async function inspectPublicFile(config: ArtConfig, task: ArtTask, publicPath: string): Promise<AssetFileAudit> {
  const filePath = path.join(config.publicAssetsDir, publicPath.slice('/assets/'.length));
  try {
    const bytes = await fs.readFile(filePath);
    const info = inspectImageBytes(bytes);
    return {
      taskId: task.id,
      manifestPath: publicPath,
      filePath: path.relative(config.rootDir, filePath),
      exists: true,
      sizeBytes: bytes.byteLength,
      sha256: sha256Bytes(bytes),
      mime: info?.mimeType ?? null,
      width: info?.width ?? null,
      height: info?.height ?? null,
      readable: info !== null,
    };
  } catch {
    return {
      taskId: task.id,
      manifestPath: publicPath,
      filePath: path.relative(config.rootDir, filePath),
      exists: false,
      sizeBytes: 0,
      sha256: null,
      mime: null,
      width: null,
      height: null,
      readable: false,
    };
  }
}

async function walkFiles(dir: string, output: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, output);
    else output.push(full);
  }
  return output;
}

function statusCounts(candidates: readonly CandidateMetadata[]): Record<string, number> {
  return candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.reviewStatus] = (counts[candidate.reviewStatus] ?? 0) + 1;
    return counts;
  }, {});
}

async function buildManifestCoverage(config: ArtConfig, manifest: ArtManifest, tasks: readonly ArtTask[]): Promise<Record<string, unknown>> {
  const characterRecords: Array<Record<string, unknown>> = [];
  for (const character of CHARACTERS) {
    for (const slot of CHARACTER_SLOTS) {
      const taskId = `character/${character.id}/${slot}`;
      const task = tasks.find((candidate) => candidate.id === taskId);
      const publicPath = manifestPathForTask(manifest, taskId);
      characterRecords.push({ taskId, gameDataId: character.id, artTask: Boolean(task), manifestPath: publicPath, official: typeof publicPath === 'string', ...(task && publicPath ? { file: await inspectPublicFile(config, task, publicPath) } : {}) });
    }
  }
  const zoneRecords: Array<Record<string, unknown>> = [];
  for (const zone of ZONES) {
    const taskId = `zone/${zone.id}/background`;
    const task = tasks.find((candidate) => candidate.id === taskId);
    const publicPath = manifestPathForTask(manifest, taskId);
    const slots = manifest.zones[zone.id] ?? {};
    zoneRecords.push({ taskId, gameDataId: zone.id, artTask: Boolean(task), background: typeof publicPath === 'string', official: typeof publicPath === 'string', warning: slots.warning ?? null, restricted: slots.restricted ?? null, optionalVariants: { warning: 'optional future variant; not a Phase 4A base-art blocker', restricted: 'optional future variant; not a Phase 4A base-art blocker' }, ...(task && publicPath ? { file: await inspectPublicFile(config, task, publicPath) } : {}) });
  }
  const itemTasks = tasks.filter((task) => task.category === 'item');
  const itemRecords: Array<Record<string, unknown>> = [];
  for (const task of itemTasks) {
    const publicPath = manifestPathForTask(manifest, task.id);
    itemRecords.push({ taskId: task.id, gameDataIdExists: ITEMS.some((item) => item.id === task.entityId), manifestPath: publicPath, official: typeof publicPath === 'string', ...(publicPath ? { file: await inspectPublicFile(config, task, publicPath) } : {}) });
  }
  const eventRecords: Array<Record<string, unknown>> = [];
  for (const eventId of WORLD_EVENT_IDS) {
    const taskId = `world_event/${eventId}/illustration`;
    const task = tasks.find((candidate) => candidate.id === taskId);
    const publicPath = manifestPathForTask(manifest, taskId);
    eventRecords.push({ taskId, manifestPath: publicPath, official: typeof publicPath === 'string', fallbackOnly: eventId === 'rain', providerCompatibility: eventId === 'rain' ? 'blocked' : 'available', ...(task && publicPath ? { file: await inspectPublicFile(config, task, publicPath) } : {}) });
  }
  const files = [...characterRecords, ...zoneRecords, ...itemRecords, ...eventRecords].flatMap((record) => record.file ? [record.file as AssetFileAudit] : []);
  const issues = files.filter((file) => !file.exists || !file.readable).map((file) => `${file.taskId}: missing or undecodable public file`);
  const allBaseOfficial = characterRecords.every((record) => record.official) && zoneRecords.every((record) => record.official) && itemRecords.every((record) => record.official) && eventRecords.filter((record) => !record.fallbackOnly).every((record) => record.official);
  return {
    generatedAt: new Date().toISOString(),
    source: { characters: 'src/data/characters.ts', zones: 'src/data/zones.ts', items: 'art/tasks/items.json via ArtTask definitions plus src/data/items.ts identity check', worldEvents: 'src/core/worldEvents.ts' },
    counts: { characterVariantsRequired: characterRecords.length, characterVariantsOfficial: characterRecords.filter((record) => record.official).length, zoneBackgroundRequired: zoneRecords.length, zoneBackgroundOfficial: zoneRecords.filter((record) => record.official).length, itemArtTasks: itemRecords.length, itemArtOfficial: itemRecords.filter((record) => record.official).length, worldEventOfficial: eventRecords.filter((record) => record.official).length, worldEventFallbackOnly: eventRecords.filter((record) => record.fallbackOnly).length },
    character: characterRecords,
    zones: zoneRecords,
    items: itemRecords,
    worldEvents: eventRecords,
    files,
    issues,
    passed: issues.length === 0 && allBaseOfficial,
  };
}

async function buildProvenanceAudit(config: ArtConfig, manifest: ArtManifest, tasks: readonly ArtTask[], candidates: readonly CandidateMetadata[], publishedOnlyCi: boolean): Promise<Record<string, unknown>> {
  const provenance = await readProvenance(config);
  const entries = manifestEntries(manifest);
  const byTask = new Map(candidates.map((candidate) => [`${candidate.taskId}:${candidate.hash}`, candidate]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const missingProvenance: string[] = [];
  const pathMismatches: string[] = [];
  const missingCandidates: string[] = [];
  const missingCandidateFiles: string[] = [];
  const missingPublicFiles: string[] = [];
  const candidateHashMismatches: string[] = [];
  const promptHashMismatches: string[] = [];
  const candidateContentHashMismatches: string[] = [];
  const publicContentHashMismatches: string[] = [];
  const candidatePublicByteMismatches: string[] = [];
  const unapprovedSources: string[] = [];
  const failedValidationSources: string[] = [];
  let candidateMetadataChecked = 0;
  let candidateBytesChecked = 0;
  let publicBytesChecked = 0;
  let publicCandidateHashMatches = 0;
  for (const entry of entries) {
    const source = provenance.assets[entry.taskId];
    if (!source) { missingProvenance.push(entry.taskId); continue; }
    if (source.publicPath !== entry.publicPath) pathMismatches.push(entry.taskId);
    const candidate = byTask.get(`${entry.taskId}:${source.candidateHash}`);
    if (!candidate) {
      if (!publishedOnlyCi) missingCandidates.push(entry.taskId);
      else {
        try {
          const publicBytes = await fs.readFile(path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length)));
          publicBytesChecked += 1;
          if (sha256Bytes(publicBytes) !== source.contentHash) publicContentHashMismatches.push(entry.taskId);
        } catch {
          missingPublicFiles.push(entry.taskId);
        }
      }
      continue;
    }
    candidateMetadataChecked += 1;
    if (candidate.hash !== source.candidateHash) candidateHashMismatches.push(entry.taskId);
    if (candidate.promptHash !== source.promptHash) promptHashMismatches.push(entry.taskId);
    if (candidate.contentHash !== source.contentHash) candidateContentHashMismatches.push(`${entry.taskId}: provenance contentHash differs from candidate`);
    if (candidate.reviewStatus !== 'approved') unapprovedSources.push(entry.taskId);
    if (candidate.validationStatus !== 'passed') failedValidationSources.push(entry.taskId);
    const task = taskById.get(entry.taskId);
    try {
      const candidateBytes = await fs.readFile(path.join(config.rootDir, candidate.imagePath));
      if (!task) {
        candidateContentHashMismatches.push(`${entry.taskId}: task definition missing`);
      } else {
        candidateBytesChecked += 1;
        if (sha256Bytes(candidateBytes) !== candidate.contentHash) candidateContentHashMismatches.push(entry.taskId);
      }
      try {
        const publicBytes = await fs.readFile(path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length)));
        publicBytesChecked += 1;
        if (sha256Bytes(publicBytes) !== source.contentHash) publicContentHashMismatches.push(entry.taskId);
        if (!candidateBytes.equals(publicBytes)) candidatePublicByteMismatches.push(entry.taskId);
        if (sha256Bytes(candidateBytes) === candidate.contentHash && sha256Bytes(publicBytes) === source.contentHash && candidateBytes.equals(publicBytes)) publicCandidateHashMatches += 1;
      } catch {
        missingPublicFiles.push(entry.taskId);
      }
    } catch {
      missingCandidateFiles.push(entry.taskId);
    }
  }
  const manifestTaskIds = new Set(entries.map((entry) => entry.taskId));
  const provenanceNotInManifest = Object.keys(provenance.assets).filter((taskId) => !manifestTaskIds.has(taskId));
  const publicFiles = (await walkFiles(config.publicAssetsDir)).filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const publicAiWithoutProvenance = publicFiles
    .map((file) => `/assets/${path.relative(config.publicAssetsDir, file)}`)
    .filter((publicPath) => publicPath.endsWith('.png') || publicPath.endsWith('.jpg') || publicPath.endsWith('.jpeg') || publicPath.endsWith('.webp') || publicPath.endsWith('.gif'))
    .filter((publicPath) => !entries.some((entry) => entry.publicPath === publicPath));
  const approvedByTask = new Map<string, CandidateMetadata[]>();
  for (const candidate of candidates.filter((candidate) => candidate.reviewStatus === 'approved')) approvedByTask.set(candidate.taskId, [...(approvedByTask.get(candidate.taskId) ?? []), candidate]);
  const duplicateApprovedSources = [...approvedByTask.entries()].filter(([, values]) => values.length > 1).map(([taskId]) => taskId);
  const fullLocalChain = entries.length === 35 && candidateMetadataChecked === 35 && candidateBytesChecked === 35 && publicBytesChecked === 35 && publicCandidateHashMatches === 35;
  const ciPublishedChain = publishedOnlyCi && entries.length === 35 && candidateMetadataChecked === 0 && candidateBytesChecked === 0 && publicBytesChecked === 35;
  const passed = (fullLocalChain || ciPublishedChain) && missingProvenance.length === 0 && pathMismatches.length === 0 && missingCandidates.length === 0 && missingCandidateFiles.length === 0 && missingPublicFiles.length === 0 && candidateHashMismatches.length === 0 && promptHashMismatches.length === 0 && candidateContentHashMismatches.length === 0 && publicContentHashMismatches.length === 0 && candidatePublicByteMismatches.length === 0 && unapprovedSources.length === 0 && failedValidationSources.length === 0 && provenanceNotInManifest.length === 0 && publicAiWithoutProvenance.length === 0 && duplicateApprovedSources.length === 0;
  return { generatedAt: new Date().toISOString(), mode: publishedOnlyCi ? 'published-only-ci' : 'full-local-candidate-chain', officialManifestEntries: entries.length, provenanceEntries: Object.keys(provenance.assets).length, candidateMetadataChecked, candidateBytesChecked, publicBytesChecked, publicCandidateHashMatches, reverseMapping: entries, missingProvenance, missingCandidates, missingCandidateFiles, missingPublicFiles, pathMismatches, candidateHashMismatches, promptHashMismatches, candidateContentHashMismatches, publicContentHashMismatches, candidatePublicByteMismatches, unapprovedSources, failedValidationSources, provenanceNotInManifest, publicAiWithoutProvenance, duplicateApprovedSources, legacyAllowlist: ['/assets/items/bandage.svg'], passed };
}

function buildCandidateHygiene(manifest: ArtManifest, candidates: readonly CandidateMetadata[], provenance: { assets: Record<string, { candidateHash: string }> }, publishedOnlyCi: boolean): Record<string, unknown> {
  if (publishedOnlyCi && candidates.length === 0) return { generatedAt: new Date().toISOString(), mode: 'published-only-ci', statusCounts: {}, totalCandidates: 0, byTask: [], requiredHistoricalRejected: [], rejectedReferencedByManifest: [], pendingReferencedByManifest: [], passed: true, note: 'Candidate store is intentionally local/ignored; public/provenance bytes are checked by the provenance audit.' };
  const entries = manifestEntries(manifest);
  const manifestPaths = new Set(entries.map((entry) => entry.publicPath));
  const currentHashes = new Set(Object.values(provenance.assets).map((entry) => entry.candidateHash));
  const currentApproved = new Set(entries.map((entry) => entry.taskId));
  const byTask = new Map<string, CandidateMetadata[]>();
  for (const candidate of candidates) byTask.set(candidate.taskId, [...(byTask.get(candidate.taskId) ?? []), candidate]);
  const taskSummary = [...byTask.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, values]) => ({ taskId, counts: statusCounts(values), candidates: values.map((candidate) => ({ hash: candidate.hash, status: candidate.reviewStatus, validation: candidate.validationStatus, publicPath: candidate.publicPath, classification: candidate.reviewStatus === 'pending' ? currentApproved.has(taskId) ? 'pending candidate superseded by current approved source; retained for history' : 'pending candidate still requires human review' : candidate.reviewStatus === 'rejected' ? 'historical rejected candidate retained for audit' : candidate.reviewStatus === 'approved' ? 'current approved source or historical approved record' : 'superseded historical candidate' })) }));
  const rejectedReferencedByManifest = candidates.filter((candidate) => candidate.reviewStatus === 'rejected' && currentHashes.has(candidate.hash) && manifestPaths.has(candidate.publicPath)).map((candidate) => candidate.hash);
  const pendingReferencedByManifest = candidates.filter((candidate) => candidate.reviewStatus === 'pending' && currentHashes.has(candidate.hash) && manifestPaths.has(candidate.publicPath)).map((candidate) => candidate.hash);
  const requiredRejected = ['80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1', '752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159'];
  const requiredRejectedStatus = requiredRejected.map((hash) => ({ hash, present: candidates.some((candidate) => candidate.hash === hash), rejected: candidates.some((candidate) => candidate.hash === hash && candidate.reviewStatus === 'rejected') }));
  return { generatedAt: new Date().toISOString(), statusCounts: statusCounts(candidates), totalCandidates: candidates.length, byTask: taskSummary, requiredHistoricalRejected: requiredRejectedStatus, rejectedReferencedByManifest, pendingReferencedByManifest, passed: rejectedReferencedByManifest.length === 0 && pendingReferencedByManifest.length === 0 && requiredRejectedStatus.every((entry) => entry.present && entry.rejected) };
}

function buildRuntimeUsage(manifest: ArtManifest, tasks: readonly ArtTask[]): Record<string, unknown> {
  const officialCharacterSlots = Object.values(manifest.characters).flatMap((slots) => CHARACTER_SLOTS.filter((slot) => typeof slots[slot] === 'string'));
  const officialZones = Object.values(manifest.zones).filter((slots) => typeof slots.background === 'string').length;
  const officialItems = Object.values(manifest.items).filter((value) => typeof value === 'string').length;
  const officialEvents = Object.entries(manifest.worldEvents).filter(([id, value]) => id !== 'rain' && typeof value === 'string').length;
  const surfaces = [
    { component: 'MenuScreen', getter: 'getCharacterVisual', variants: ['portrait'], condition: 'character selection cards', fallback: 'VisualImage formal → SVG → emoji' },
    { component: 'StatusBar', getter: 'getCharacterVisual + resolveCharacterVisualState', variants: ['portrait', 'injured', 'combat'], condition: 'derived from HP and active encounter; injured > combat > portrait', fallback: 'VisualImage formal → SVG → emoji' },
    { component: 'EncounterHero', getter: 'getCharacterVisual + resolveCharacterVisualState', variants: ['portrait', 'injured', 'combat'], condition: 'visible opponent during encounter; no hidden remote NPC state', fallback: 'VisualImage formal → SVG → emoji' },
    { component: 'ZoneMap/GameScreen', getter: 'getZoneVisual', variants: ['background'], condition: 'zone map and current stage/event context', fallback: 'VisualImage formal → SVG → emoji' },
    { component: 'Inventory', getter: 'getItemVisual', variants: ['icon'], condition: 'visible item inventory rows', fallback: 'category emoji' },
    { component: 'GameScreen event banner', getter: 'getWorldEventVisual', variants: ['illustration'], condition: 'active relevant world event', fallback: 'event SVG → emoji; Rain remains fallback-only' },
  ];
  const issues = [
    ...(officialCharacterSlots.length === 12 ? [] : ['character official slot count is not 12']),
    ...(officialZones === 6 ? [] : ['zone background official count is not 6']),
    ...(officialItems === 12 ? [] : ['item official count is not 12']),
    ...(officialEvents === 5 ? [] : ['official world event count is not 5']),
    ...(tasks.some((task) => task.id === 'character/scout/combat') ? [] : ['Scout Combat task missing']),
  ];
  return { generatedAt: new Date().toISOString(), assetCategory: { characters: { manifestSlots: 12, official: officialCharacterSlots.length, getter: 'getCharacterVisual', uiConsumers: ['MenuScreen', 'StatusBar', 'EncounterHero'] }, zones: { manifestSlots: 6, official: officialZones, getter: 'getZoneVisual', uiConsumers: ['ZoneMap', 'GameScreen'] }, items: { manifestSlots: 12, official: officialItems, getter: 'getItemVisual', uiConsumers: ['Inventory'] }, worldEvents: { manifestSlots: 6, official: officialEvents, fallbackOnly: ['rain'], getter: 'getWorldEventVisual', uiConsumers: ['GameScreen event banner'] } }, surfaces, resolver: { name: 'resolveCharacterVisualState', location: 'src/ui/characterVisualState.ts', derivedOnly: true, precedence: 'injured > combat > portrait', injuredThreshold: 0.35, activeEncounterSource: 'state.encounter', persisted: false }, fallback: { component: 'VisualImage', stages: ['formal AI', 'local SVG', 'emoji/color'], officialImageError: 'tested', unknownIds: 'tested', rain: 'fallback-only and tested' }, issues, passed: issues.length === 0 };
}

export async function runPhase4A45Audit(config: ArtConfig, options: Phase4A45AuditOptions = {}): Promise<Phase4A45AuditResult> {
  const [manifest, tasks, candidates, provenanceFile] = await Promise.all([readManifest(config), loadTasks(config.rootDir), listCandidates(config), readProvenance(config)]);
  const publishedOnlyCi = options.publishedOnlyCi ?? (process.env.CI === 'true' && candidates.length === 0);
  const [manifestCoverage, provenance, candidateHygiene] = await Promise.all([
    buildManifestCoverage(config, manifest, tasks),
    buildProvenanceAudit(config, manifest, tasks, candidates, publishedOnlyCi),
  ]).then(async ([coverage, provenanceAudit]) => [coverage, provenanceAudit, buildCandidateHygiene(manifest, candidates, provenanceFile, publishedOnlyCi)] as const);
  const runtimeUsage = buildRuntimeUsage(manifest, tasks);
  const result: Phase4A45AuditResult = {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 4A-4.5.1',
    passed: Boolean(manifestCoverage.passed && provenance.passed && candidateHygiene.passed && runtimeUsage.passed),
    manifestCoverage,
    provenance,
    candidateHygiene,
    runtimeUsage,
  };
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  await fs.writeFile(path.join(config.rootDir, 'reports/phase4a451-manifest-coverage.json'), `${JSON.stringify(manifestCoverage, null, 2)}\n`);
  await fs.writeFile(path.join(config.rootDir, 'reports/phase4a451-provenance-audit.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  await fs.writeFile(path.join(config.rootDir, 'reports/phase4a451-candidate-hygiene.json'), `${JSON.stringify(candidateHygiene, null, 2)}\n`);
  await fs.writeFile(path.join(config.rootDir, 'reports/phase4a451-runtime-usage.json'), `${JSON.stringify(runtimeUsage, null, 2)}\n`);
  return result;
}
