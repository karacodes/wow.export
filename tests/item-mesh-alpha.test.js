/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	How each item mesh fades in Stand, as the sidecar records it (src/js/wow/item-mesh-alpha.js).
	The case is the Garona dagger (item 128870, appearance 29, model 1348471, skin 1348553, read
	from the game files 2026-11-26): eight sections; four ghost blades (3 to 6) take turns
	through their colour alpha, section 0 flashes when they switch, the hilt (1, 7) and the big
	flame card (2) have no colour track. Every texture weight is a constant 1.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { section_alpha_track, alpha_tracks_by_mesh, track_keys } = require('../src/js/wow/item-mesh-alpha');

const S = 32767;
const track = (keys, globalSeq = 65535) => ({ globalSeq, timestamps: [keys.map(k => k[0])], values: [keys.map(k => Math.round(k[1] * S))] });

// Stand (sequence 0) keys of the dagger's colour alpha tracks, as in the game files
const COLOR_ALPHA = [
	[[0, 1], [6233, 1], [7933, 0], [12200, 0], [14400, 1], [18733, 1], [20467, 0], [25100, 0], [26967, 1], [33333, 1]], // blade _4
	[[0, 0], [7300, 1], [9767, 0], [12600, 1], [16700, 0], [22600, 1], [33333, 0]],                                     // flash _0
	[[0, 0], [19400, 0], [21000, 1], [22600, 1], [25733, 0], [33333, 0]],                                               // blade _3
	[[0, 0], [5633, 0], [9333, 1], [12667, 1], [15333, 0], [33333, 0]],                                                 // blade _5
	[[0, 0], [23100, 0], [25600, 1], [28200, 0], [33333, 0]]                                                            // blade _6
];
const DAGGER_M2 = {
	animations: [{ duration: 33333 }, { duration: 16667 }, { duration: 16666 }],
	globalLoops: [],
	colors: COLOR_ALPHA.map(keys => ({ color: track([[0, 1]]), alpha: track(keys) })),
	textureWeights: [track([[0, 1]])],
	transparencyLookup: [0]
};
// section -> colour index (65535 = none), as in the skin's texture units
const SECTION_COLOR = [1, 65535, 65535, 2, 0, 3, 4, 65535];
const DAGGER_SKIN = { textureUnits: SECTION_COLOR.map((colorIndex, i) => ({ skinSectionIndex: i, colorIndex, textureWeightComboIndex: 0 })) };

test('the four ghost blades and the flash fade; the hilt and the flame card do not', () => {
	const faded = SECTION_COLOR.map((_, i) => section_alpha_track(DAGGER_M2, DAGGER_SKIN, i) !== null);
	assert.deepEqual(faded, [true, false, false, true, true, true, true, false]);
});

test('a blade\'s track is its colour alpha over the Stand loop', () => {
	const blade = section_alpha_track(DAGGER_M2, DAGGER_SKIN, 4);
	assert.equal(blade.duration, 33333);
	assert.deepEqual(blade.keys[0], [0, 1]);
	assert.deepEqual(blade.keys[2], [7933, 0]);
	assert.equal(blade.keys.length, 10);
});

test('colour alpha is multiplied by an animated texture weight', () => {
	const m2 = { ...DAGGER_M2, textureWeights: [track([[0, 1], [16000, 0.5], [33333, 1]])] };
	const blade = section_alpha_track(m2, DAGGER_SKIN, 4);
	const at = t => blade.keys.find(k => k[0] === t)[1];
	assert.equal(at(0), 1);
	assert.ok(Math.abs(at(16000) - 0.5) < 0.01, `at 16000: ${at(16000)}`);
	// the hilt has no colour track, but the animated weight alone now makes it fade
	assert.notEqual(section_alpha_track(m2, DAGGER_SKIN, 1), null);
});

test('a global sequence track loops over its global loop, not the animation', () => {
	const m2 = { animations: [{ duration: 1000 }], globalLoops: [5000] };
	assert.deepEqual(track_keys(track([[0, 0], [2500, 1]], 0), m2), { duration: 5000, keys: [[0, 0], [2500, 1]] });
	assert.equal(track_keys(track([[0, 0], [500, 1]]), m2).duration, 1000);
	assert.equal(track_keys({ globalSeq: 65535, timestamps: [], values: [] }, m2), null);
});

test('a section without a texture unit has no track', () => {
	assert.equal(section_alpha_track(DAGGER_M2, DAGGER_SKIN, 9), null);
	assert.equal(section_alpha_track(null, null, 0), null);
});

test('the sidecar map is keyed by mesh name and skips meshes that never fade', () => {
	const names = SECTION_COLOR.map((_, i) => `Main-hand_Item128870_${i}`);
	const tracks = SECTION_COLOR.map((_, i) => section_alpha_track(DAGGER_M2, DAGGER_SKIN, i));
	const out = alpha_tracks_by_mesh(names, tracks);
	assert.deepEqual(Object.keys(out), ['Main-hand_Item128870_0', 'Main-hand_Item128870_3', 'Main-hand_Item128870_4', 'Main-hand_Item128870_5', 'Main-hand_Item128870_6']);
	assert.deepEqual(alpha_tracks_by_mesh(names, undefined), {});
});
