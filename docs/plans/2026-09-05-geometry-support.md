# Approved geometry support repair

Scope: inspect reference photo and current source; retain existing mixed rib/acrylic/none handling, 2040 strong-axis transform, beam end gaps, node UI and procurement accounting. No pricing/admin/deployment work.

Backup: backups/geometry-support-20260905-112854 (source + existing tests).

1. Add failing Node regression tests: 2040 middle enclosed chamber and rotated 4020 bores; each cantilever tongue really overlaps a strip at narrow/unequal bay widths; direct #node alias.
2. Fix profile hollow-cell layout using dimension-oriented central bores and a bounded central chamber. These are illustrative cross sections, not measured supplier CAD.
3. Extend cantilever bearing tongue width enough to contact the nearest strips, without changing purchasing quantity/length or previous acrylic pads.
4. Verify geometry through actual transformed vertex bounds, ray intersections with end caps, nonpenetration across posts/beams, support contact, and frozen pre-change procurement fixtures. Preserve already-correct beam transforms rather than redoing them.
5. Run npm test and npm run build; parent handles browser acceptance, local server/opening. #profile/node already exists; add #node alias.

Photo confirms slots/bores, continuous posts and beams beneath strips; hidden fastening and manufacturing tolerances remain schematic.

## Execution outcome
- New regression initially failed 5/7 cases: middle chamber, rotated twin bores, unsupported tongues for both series, #node alias. Transform and procurement controls already passed.
- Actual source edits: profiles.js (middle diamond chamber / oriented twin bores), buildShelf.js (70mm visual tongue width instead of 50mm), main.js (#node alias).
- Existing beam shortening/axis placement, joint visual deduplication, acrylic pad contact, mixed layer handling, anims.js and hud.js retained.
- Added test/geometry-support.test.mjs plus test/procurement-before-geometry.json captured before edits; all procurement stats match exactly in the two fixture configurations.
- npm test: 25 passed, zero failures. npm run build: success, 30 modules, dist/index.html singlefile 603.14 kB.
- Browser visual acceptance is intentionally pending parent agent; no server launched, no browser opened, no external publishing.
- Test artifact URL: file:///F:/Autoclaw/alu_extrusion/dist/index.html#node; dev alternative after starting Vite: http://127.0.0.1:5173/#node (port must be confirmed by parent).

