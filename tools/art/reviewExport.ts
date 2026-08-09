import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listCandidates } from './reviewer';
import type { ArtConfig, CandidateMetadata } from './types';

export const ROUND_A_TASKS = [
  'character/scout/portrait',
  'zone/school/background',
  'item/bandage/icon',
  'world_event/blackout/illustration',
] as const;

const OUTPUT_DIR = path.join('output', 'art-review', 'phase4a1-round-a');
const OUTPUT_NAMES: Record<string, string> = {
  'character/scout/portrait': 'scout-portrait',
  'zone/school/background': 'school-background',
  'item/bandage/icon': 'bandage-icon',
  'world_event/blackout/illustration': 'blackout-illustration',
  'character/fighter/portrait': 'fighter-portrait',
  'character/engineer/portrait': 'engineer-portrait',
  'character/medic/portrait': 'medic-portrait',
  'zone/hospital/background': 'hospital-background',
  'item/medkit/icon': 'medkit-icon',
  'world_event/rain/illustration': 'rain-illustration',
  'zone/residential/background': 'residential-background',
  'zone/factory/background': 'factory-background',
  'zone/forest/background': 'forest-background',
  'zone/lab/background': 'lab-background',
  'item/water/icon': 'water-icon',
  'item/energy_drink/icon': 'energy-drink-icon',
  'item/battery/icon': 'battery-icon',
  'item/iron/icon': 'iron-icon',
  'item/wood/icon': 'wood-icon',
  'item/iron_pipe/icon': 'iron-pipe-icon',
  'item/stone_axe/icon': 'stone-axe-icon',
  'item/simple_bow/icon': 'simple-bow-icon',
  'item/simple_armor/icon': 'simple-armor-icon',
  'item/plate_armor/icon': 'plate-armor-icon',
  'world_event/emergency_broadcast/illustration': 'emergency-broadcast-illustration',
  'world_event/medical_alert/illustration': 'medical-alert-illustration',
  'world_event/research_anomaly/illustration': 'research-anomaly-illustration',
  'world_event/citywide_unrest/illustration': 'citywide-unrest-illustration',
  'character/scout/injured': 'scout-injured',
  'character/fighter/injured': 'fighter-injured',
  'character/engineer/injured': 'engineer-injured',
  'character/medic/injured': 'medic-injured',
  'character/scout/combat': 'scout-combat',
};

const REVIEW_REMINDERS: Record<string, string> = {
  'character/scout/portrait': 'Check that binoculars are the only prominent equipment and that hands, back, and shoulders are free of weapons; remember the v1 rifle issue.',
  'zone/school/background': 'Check for zero people, zero human silhouettes, and a calm open lower center; remember the v1 central-person and silhouette issue.',
  'item/bandage/icon': 'Check for exactly one centered isolated object on a neutral backdrop with no scenery, frame, arrows, buttons, or text; remember the v1 ruins/HUD/frame issue.',
  'world_event/blackout/illustration': 'Check the v5 close electrical control-area composition: ceiling out of frame, black displays and controls, zero green/white normal lights, and exactly one dim red emergency beacon.',
  'character/fighter/portrait': 'Positive-only review: check occupational identity, clean shoulder/back silhouette, sport wraps/gloves, and no injured variant.',
  'character/engineer/portrait': 'Positive-only review: check workshop repair identity, short wrench/tool belt, clean shoulder/back silhouette, and no injured variant.',
  'character/medic/portrait': 'Positive-only review: check community first-aid identity, compact pouch, clean shoulder/back silhouette, and no injured variant.',
  'zone/hospital/background': 'Check that the medical waiting hall reads as completely vacant, all visible chairs are empty, the location identity is clear, and the lower center remains usable for UI.',
  'item/medkit/icon': 'Check for one isolated case with blank surfaces, no red-cross or protected humanitarian marking, no readable text/logo, clear emergency-supply identity, and small-size readability.',
  'world_event/rain/illustration': 'Check that rainfall is immediately recognizable, the street reads as deserted, no people or HUD are visible, and the image remains distinct from Blackout.',
  'zone/residential/background': 'Check residential identity, no visible people or HUD, usable lower center, and visual distinction from School/Hospital.',
  'zone/factory/background': 'Check industrial identity, readable machinery/workbench composition, no visible workers or HUD, and preserved UI space.',
  'zone/forest/background': 'Check woodland identity, no unexpected character or creature focal subject, readable path depth, no HUD, and distinction from urban zones.',
  'zone/lab/background': 'Check research-lab identity, no visible personnel or HUD, lower-center space, and distinction from Hospital.',
  'item/water/icon': 'Check exactly one bottle, clear water identity, no brand or readable text, isolated background, and small-size readability.',
  'item/energy_drink/icon': 'Check exactly one can, generic original beverage design, no real brand or readable text, isolated background, and clear small-size silhouette.',
  'item/battery/icon': 'Check compact battery identity, isolated object, plain generic surface, visible terminals, no scene or UI contamination, and small-size readability.',
  'item/iron/icon': 'Check raw iron material identity, isolated object, dense rectangular form, no tool/weapon/armor transformation, and small-size readability.',
  'item/wood/icon': 'Check cut-timber material identity, isolated object, grain and rough ends, no tree/forest/woodpile scene, and small-size readability.',
  'item/iron_pipe/icon': 'Check clear hollow pipe identity, isolated object, open circular ends, no firearm confusion, no character, and readable silhouette.',
  'item/stone_axe/icon': 'Check stone head, wooden handle and handmade identity; no character, fantasy ornament or glow.',
  'item/simple_bow/icon': 'Check plain handmade bow identity, curved limbs and string, no character, arrows or fantasy glow.',
  'item/simple_armor/icon': 'Check equipment item only, no wearer or mannequin, protective function clear, and readable at small size.',
  'item/plate_armor/icon': 'Check reinforced plate equipment item only, no wearer or mannequin, protective function clear, and readable at small size.',
  'world_event/emergency_broadcast/illustration': 'Check the unattended civic communications room, public-address speaker, communications console, abstract non-readable signal displays, amber status lights and single amber warning beacon; no text, map or coordinates.',
  'world_event/medical_alert/illustration': 'Check the hospital emergency supply station, off-white cases, muted green panels, blank surfaces and compact amber-and-green status beacon; no cross, logo or emblem.',
  'world_event/research_anomaly/illustration': 'Check the contained instrument anomaly in the research chamber, sealed glass apparatus, blue-violet disturbance and abstract waveforms; no monster, magic or portal.',
  'world_event/citywide_unrest/illustration': 'Check the disordered city intersection, displaced barriers, overturned bins, scattered paper and municipal warning beacons; no people, riot, protest, battle, weapon, fire or explosion.',
  'character/scout/injured': 'Canary review: compare beside the official Scout portrait. Check descriptor-locked identity, mild injury only, binoculars, neck strap, side pouch, slate-blue jacket and no military/tactical contamination.',
  'character/fighter/injured': 'Compare beside the official Fighter portrait. Accept natural text-to-image variation; assess player-recognizable identity, mild injury only, and preserved athletic clothing and glove/wrap identity.',
  'character/engineer/injured': 'Compare beside the official Engineer portrait. Accept natural text-to-image variation; assess player-recognizable identity, mild injury only, and preserved ochre workwear, tool belt and compact wrench identity.',
  'character/medic/injured': 'Compare beside the official Medic portrait. Accept natural text-to-image variation; assess player-recognizable identity, mild injury only, and preserved green/off-white workwear and white-and-green pouch identity.',
  'character/scout/combat': 'Compare beside the official Scout Portrait and Injured portrait. Check active tension without fixed weapon, military/tactical contamination or injured-state drift.',
};
const REVIEW_CHECKLISTS: Record<string, string[]> = {
  'character/scout/portrait': [
    'no firearm of any kind', 'nothing visible behind either shoulder', 'no gun stock/barrel', 'no gun holster', 'no camouflage', 'no tactical/military vest', 'both hands empty', 'binoculars remain clear', 'civilian clothing', 'adult 28–32 appearance',
  ],
  'world_event/blackout/illustration': [
    'close or medium-close control area', 'ceiling outside the frame', 'zero ceiling lamps visible', 'no windows', 'no exterior view', 'no people', 'no weather/rain', 'no HUD/interface/text', 'all digital displays black', 'control panels and indicator arrays dark', 'zero green lights', 'zero white normal lights', 'exactly one dim red emergency beacon', 'image is predominantly dark', 'immediately reads as blackout',
  ],
  'character/fighter/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'character/engineer/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'character/medic/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'zone/hospital/background': ['entire location reads as vacant', 'every visible chair is empty', 'no visible people', 'medical waiting area identity clear', 'lower center usable for UI'],
  'item/medkit/icon': ['exactly one object', 'clean isolated background', 'no red-cross emblem', 'no protected humanitarian marking', 'no readable text/logo', 'medical/emergency supply identity still clear', 'readable at small size'],
  'world_event/rain/illustration': ['rainfall immediately recognizable', 'street reads as deserted', 'no visible people', 'no HUD', 'visually distinct from Blackout'],
  'zone/residential/background': ['residential identity clear', 'no visible people', 'no HUD', 'lower-center usable for UI', 'visually distinct from School/Hospital'],
  'zone/factory/background': ['industrial identity clear', 'machinery/workbench composition readable', 'no visible workers', 'no HUD', 'UI space preserved'],
  'zone/forest/background': ['woodland identity clear', 'no unexpected character/creature focal subject', 'path/readable depth', 'no HUD', 'visually distinct from urban zones'],
  'zone/lab/background': ['research-lab identity clear', 'no visible personnel', 'no HUD', 'distinct from Hospital', 'lower-center usable'],
  'item/water/icon': ['exactly one bottle', 'clear water identity', 'no brand/readable text', 'isolated background', 'readable at small size'],
  'item/energy_drink/icon': ['exactly one can', 'beverage identity clear', 'original generic design', 'no real brand', 'no readable text', 'isolated background'],
  'item/battery/icon': ['correct material identity', 'isolated object', 'plain generic surface', 'visible terminals', 'no scene contamination', 'no HUD', 'readable at inventory size'],
  'item/iron/icon': ['correct material identity', 'isolated object', 'raw iron block identity', 'no weapon/armor transformation', 'no scene contamination', 'readable at inventory size'],
  'item/wood/icon': ['correct material identity', 'isolated object', 'grain and rough cut ends', 'not a tree/forest scene', 'no HUD', 'readable at inventory size'],
  'item/iron_pipe/icon': ['reads clearly as pipe', 'isolated object', 'open circular ends', 'not confused with firearm', 'no character', 'clear silhouette'],
  'item/stone_axe/icon': ['stone head clear', 'wooden handle clear', 'handmade identity', 'no character', 'no fantasy ornament'],
  'item/simple_bow/icon': ['bow identity clear', 'plain handmade design', 'no character', 'no fantasy glow', 'readable silhouette'],
  'item/simple_armor/icon': ['equipment item only', 'no wearer', 'protective function clear', 'no mannequin focal subject', 'readable at small size'],
  'item/plate_armor/icon': ['equipment item only', 'no wearer', 'protective function clear', 'no mannequin focal subject', 'readable at small size'],
  'world_event/emergency_broadcast/illustration': ['unattended civic communications room', 'public-address speaker', 'communications console', 'abstract signal bars/geometric blocks only', 'amber warning beacon', 'no readable text/map/coordinates'],
  'world_event/medical_alert/illustration': ['hospital emergency supply station', 'off-white cases', 'muted green panels', 'blank smooth surfaces', 'amber-and-green status beacon', 'no cross/logo/emblem'],
  'world_event/research_anomaly/illustration': ['contained instrument anomaly', 'research chamber', 'sealed glass apparatus', 'blue-violet disturbance', 'abstract waveforms', 'no monster/magic/portal'],
  'world_event/citywide_unrest/illustration': ['disordered city intersection', 'displaced lightweight barriers', 'overturned bins', 'scattered paper', 'municipal warning beacons', 'no riot/protest/crowd/battle/weapon/fire/explosion'],
  'character/scout/injured': ['clearly reads as the same Scout visual identity', 'same age range', 'same hairstyle and hair color', 'same slate-blue jacket identity', 'same charcoal inner shirt', 'same khaki trouser identity where visible', 'same binoculars and neck strap', 'same civilian side pouch if visible', 'injury is mild and readable', 'no military/tactical contamination', 'no drastic face or body redesign'],
  'character/fighter/injured': ['reads naturally as the same Fighter', 'same age and short dark hair', 'same athletic build', 'same charcoal/rust-orange jacket', 'same boxing gloves/wraps', 'injury is mild', 'no drastic redesign'],
  'character/engineer/injured': ['reads naturally as the same Engineer', 'same age / hairstyle identity', 'same ochre work jacket', 'same gray shirt', 'tool belt remains recognizable', 'compact wrench/tool identity remains', 'injury is mild', 'no drastic redesign'],
  'character/medic/injured': ['reads naturally as the same Medic', 'same age / bob hairstyle identity', 'same green/off-white jacket identity', 'same first-aid pouch identity', 'injury is mild', 'no militarized redesign', 'no drastic character redesign'],
  'character/scout/combat': ['clearly reads as the same Scout', 'same age range and hairstyle', 'same slate-blue jacket identity', 'same charcoal shirt / khaki outfit language', 'binoculars remain recognizable', 'side pouch identity remains compatible', 'action/tension state clearly differs from neutral Portrait', 'clearly differs from Injured state', 'no fixed weapon', 'no military/tactical contamination', 'no drastic redesign'],
};

export interface ReviewExportOptions {
  reportPath?: string;
  outputDir?: string;
  fileSuffix?: string;
  title?: string;
}

export function selectPendingReviewCandidates(candidates: CandidateMetadata[], taskIds: readonly string[] = ROUND_A_TASKS): CandidateMetadata[] {
  return taskIds.map((taskId) => {
    const matches = candidates
      .filter((candidate) => candidate.taskId === taskId && candidate.reviewStatus === 'pending' && candidate.validationStatus === 'passed')
      .sort((a, b) => Number(b.source === 'api') - Number(a.source === 'api') || b.generatedAt.localeCompare(a.generatedAt));
    if (!matches[0]) throw new Error(`no pending validated candidate for ${taskId}`);
    return matches[0];
  });
}

export async function selectCandidatesFromReport(config: ArtConfig, reportPath: string): Promise<CandidateMetadata[]> {
  const parsed = JSON.parse(await fs.readFile(path.isAbsolute(reportPath) ? reportPath : path.join(config.rootDir, reportPath), 'utf8')) as {
    tasks?: Array<{ taskId?: string; candidateHash?: string | null; hash?: string | null; validation?: string | { status?: string }; review?: string }>;
  };
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) throw new Error('review report has no tasks');
  const candidates = await listCandidates(config);
  const attempted = parsed.tasks.filter((entry) => !(entry.candidateHash == null && (entry.validation === 'not_attempted' || entry.validation === 'failed')));
  const selected = attempted.map((entry) => {
    const candidateHash = entry.candidateHash ?? entry.hash;
    if (!entry.taskId || !candidateHash) throw new Error('review report task is missing taskId or candidateHash');
    const candidate = candidates.find((item) => item.taskId === entry.taskId && item.hash === candidateHash);
    if (!candidate) throw new Error(`review report candidate not found: ${entry.taskId} / ${candidateHash}`);
    if (candidate.validationStatus !== 'passed' || candidate.reviewStatus !== 'pending') throw new Error(`review report candidate is not pending/passed: ${entry.taskId}`);
    const validationStatus = typeof entry.validation === 'string' ? entry.validation : entry.validation?.status;
    if (validationStatus && validationStatus !== candidate.validationStatus) throw new Error(`review report validation mismatch: ${entry.taskId}`);
    if (entry.review && entry.review !== candidate.reviewStatus) throw new Error(`review report review status mismatch: ${entry.taskId}`);
    return candidate;
  });
  if (new Set(selected.map((candidate) => candidate.taskId)).size !== selected.length) throw new Error('review report contains duplicate task ids');
  return selected;
}

export async function exportRoundAReview(config: ArtConfig, options: ReviewExportOptions = {}): Promise<{ outputDir: string; candidates: CandidateMetadata[] }> {
  const candidates = options.reportPath
    ? await selectCandidatesFromReport(config, options.reportPath)
    : selectPendingReviewCandidates(await listCandidates(config));
  const outputDir = path.join(config.rootDir, options.outputDir ?? OUTPUT_DIR);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const assets = [] as Array<{ taskId: string; candidateHash: string; file: string }>;
  const readme: string[] = [
    `# ${options.title ?? 'Phase 4A-1 Round A Review Package'}`,
    '',
    'Automatic validation is recorded below. Human review decisions intentionally remain blank.',
    '',
    '| Task | Candidate Hash | File | Actual Resolution | Validation | Review |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const candidate of candidates) {
    const extension = path.extname(candidate.imagePath).slice(1) || 'bin';
    const file = `${OUTPUT_NAMES[candidate.taskId] ?? candidate.taskId.replaceAll('/', '-')}${options.fileSuffix ?? ''}.${extension}`;
    await fs.copyFile(path.join(config.rootDir, candidate.imagePath), path.join(outputDir, file));
    assets.push({ taskId: candidate.taskId, candidateHash: candidate.hash, file });
    readme.push(`| ${candidate.taskId} | ${candidate.hash} | ${file} | ${candidate.actualWidth}×${candidate.actualHeight} | ${candidate.validationStatus} | pending |`);
    readme.push('');
    readme.push('Decision: __________');
    readme.push('Notes: __________');
    readme.push(`Review reminder: ${REVIEW_REMINDERS[candidate.taskId] ?? 'Review against the task brief and hard constraints.'}`);
    const checklist = REVIEW_CHECKLISTS[candidate.taskId];
    if (checklist) {
      readme.push('');
      readme.push('Human review checklist:');
      checklist.forEach((item) => readme.push(`- [ ] ${item}`));
    }
    readme.push('');
  }
  await fs.writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify({ assets }, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, 'README.md'), `${readme.join('\n')}\n`);
  return { outputDir, candidates };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const roundIndex = argv.indexOf('--round');
  const reportIndex = argv.indexOf('--report');
  const outputIndex = argv.indexOf('--output');
  const suffixIndex = argv.findIndex((value) => value === '--suffix' || value.startsWith('--suffix='));
  const round = roundIndex >= 0 ? argv[roundIndex + 1] : undefined;
  const reportPath = reportIndex >= 0 ? argv[reportIndex + 1] : undefined;
  const outputDir = outputIndex >= 0 ? argv[outputIndex + 1] : undefined;
  const fileSuffix = suffixIndex >= 0 ? (argv[suffixIndex].startsWith('--suffix=') ? argv[suffixIndex].slice('--suffix='.length) : argv[suffixIndex + 1]) : undefined;
  if (reportPath && round) throw new Error('use either --round or --report, not both');
  if (!reportPath && round !== 'A') throw new Error('review export currently supports only --round A');
  if (reportPath && !outputDir) throw new Error('--output is required with --report');
  const configModule = await import('./config');
  const options = reportPath ? {
    reportPath,
    outputDir,
    fileSuffix: fileSuffix ?? '',
    title: reportPath.includes('phase4a43') ? 'Phase 4A-4.3 Scout Combat Canary Review Package' : reportPath.includes('phase4a42') ? 'Phase 4A-4.2 Remaining Injured Variant Review Package' : fileSuffix === '-positive' ? 'Phase 4A-2.1 Character Positive-only Review Package' : fileSuffix === '-nonchar' ? 'Phase 4A-2.1 Non-character B1 Review Package' : fileSuffix === '-v5' ? 'Phase 4A-2 Blackout v5 Review Package' : fileSuffix === '-b1' ? 'Phase 4A-2 Controlled Round B1 Review Package' : fileSuffix === '-v4' ? 'Phase 4A-1.3 Round A4 Review Package' : fileSuffix === '-v3' ? 'Phase 4A-1.2 Round A3 Review Package' : fileSuffix === '-v2' ? 'Phase 4A-2.2 Non-character Positive-only Recovery Review Package' : fileSuffix === '-b2' ? 'Phase 4A-2.3 Controlled Production Expansion B2 Review Package' : fileSuffix === '-b3' ? 'Phase 4A-3 Item Production Batch B3 Review Package' : fileSuffix === '-rain' ? 'Phase 4A-2.3 Rain Provider Recovery Review Package' : fileSuffix === '-e1' ? 'Phase 4A-4 World Event E1 Review Package' : fileSuffix === '-canary' ? 'Phase 4A-4.1 Scout Injured Canary Review Package' : undefined,
  } : {};
  const result = await exportRoundAReview(configModule.createArtConfig(), options);
  console.log(`EXPORTED ${result.candidates.length} pending candidates to ${result.outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
