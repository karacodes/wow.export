/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The blend mode the sidecar records per item mesh (src/js/wow/item-mesh-blend.js). The case
	is the gnome male's helm 228858 (plate_raidpaladingoblin_d_01_helm_gn_m.m2, read from the
	game files 2026-10-07): six sections, the solid shell opaque, a trim alpha-blended, and four
	ember glow cards drawn additive, one of them a flat quad as tall as the figure.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { section_blend_mode, blend_modes_by_mesh } = require('../src/js/wow/item-mesh-blend');

// the helm's materials (flags, blend) and skin texture units, as in the game files
const HELM_M2 = { materials: [[4, 0], [16, 2], [16, 4], [20, 4], [20, 4], [16, 4], [20, 4], [20, 2]].map(([flags, blendingMode]) => ({ flags, blendingMode })) };
const HELM_SKIN = { textureUnits: [
	{ skinSectionIndex: 4, materialIndex: 0 },
	{ skinSectionIndex: 5, materialIndex: 3 },
	{ skinSectionIndex: 0, materialIndex: 4 },
	{ skinSectionIndex: 1, materialIndex: 5 },
	{ skinSectionIndex: 2, materialIndex: 6 },
	{ skinSectionIndex: 3, materialIndex: 7 }
] };

test('each section of the helm gets the blend mode of its texture unit', () => {
	assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => section_blend_mode(HELM_M2, HELM_SKIN, i)), [4, 4, 4, 2, 0, 4]);
});

test('the slab above the gnome male\'s head (section 1) is drawn additive', () => {
	assert.equal(section_blend_mode(HELM_M2, HELM_SKIN, 1), 4);
});

test('a section with no texture unit or material has no blend mode', () => {
	assert.equal(section_blend_mode(HELM_M2, HELM_SKIN, 9), null);
	assert.equal(section_blend_mode({ materials: [] }, HELM_SKIN, 4), null);
	assert.equal(section_blend_mode(null, null, 0), null);
});

test('the sidecar map is keyed by mesh name and skips meshes without a mode', () => {
	const names = ['Head_Item228858_0', 'Head_Item228858_1', 'Head_Item228858_4', 'Waist_Item1_0'];
	assert.deepEqual(blend_modes_by_mesh(names, [4, 4, 0, null]), { Head_Item228858_0: 4, Head_Item228858_1: 4, Head_Item228858_4: 0 });
	assert.deepEqual(blend_modes_by_mesh(names, undefined), {});
	assert.deepEqual(blend_modes_by_mesh(undefined, [1]), {});
});
