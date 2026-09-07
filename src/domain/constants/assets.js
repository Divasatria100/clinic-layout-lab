// Asset catalog for Phase 1: Visual Editor.
//
// Source: docs/08-asset-specification.md, docs/05-data-model.md.
// - `type` values are kebab-case; `asset` field stores the filename literal
//   (`<type>.png`), resolved against ASSET_BASE_PATH at render time.
// - `displayName` / `category` are UI-only metadata, never persisted in layout.
// - Default dimensions marked (*) come from reference examples in 05 §12;
//   the rest are implementation defaults — intrinsic asset scale is TBD
//   in the spec (08 §7, §18, §21).

export const ASSET_BASE_PATH = '/assets/objects'

export const ASSET_TYPES = [
  { type: 'entrance', file: 'entrance.png', displayName: 'Entrance', category: 'Access', defaultWidth: 80, defaultHeight: 80 },
  { type: 'exit', file: 'exit.png', displayName: 'Exit', category: 'Access', defaultWidth: 80, defaultHeight: 80 },
  { type: 'reception', file: 'reception.png', displayName: 'Reception', category: 'Front Desk', defaultWidth: 100, defaultHeight: 80 },
  { type: 'waiting-chair', file: 'waiting-chair.png', displayName: 'Waiting Chair', category: 'Support', defaultWidth: 120, defaultHeight: 60 },
  { type: 'examination-room', file: 'examination-room.png', displayName: 'Examination Room', category: 'Clinical', defaultWidth: 160, defaultHeight: 100 },
  { type: 'doctor-room', file: 'doctor-room.png', displayName: 'Doctor Room', category: 'Clinical', defaultWidth: 140, defaultHeight: 100 },
  { type: 'pharmacy', file: 'pharmacy.png', displayName: 'Pharmacy', category: 'Support', defaultWidth: 100, defaultHeight: 80 },
  { type: 'treatment-room', file: 'treatment-room.png', displayName: 'Treatment Room', category: 'Clinical', defaultWidth: 160, defaultHeight: 120 },
  { type: 'toilet', file: 'toilet.png', displayName: 'Toilet', category: 'Support', defaultWidth: 80, defaultHeight: 80 },
]

export function getAssetType(type) {
  return ASSET_TYPES.find((entry) => entry.type === type)
}

export function isKnownAssetType(type) {
  return getAssetType(type) !== undefined
}

// Resolve a stored `asset` filename to a loadable URL.
// Keeps layout data to filename literals per 08 §4-§5.
export function resolveAssetUrl(asset) {
  return `${ASSET_BASE_PATH}/${asset}`
}
