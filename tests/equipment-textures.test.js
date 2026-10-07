/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for the blood elf's untextured warglaives (Kara's export,
	2026-10-07): knife_1h_deathwingraid_e_03.m2 carries its textures in the model
	(type 0) and its item display lists none, so the export wrote no material. The
	equipment export must write the model's own textures too.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { REPLACEABLE_SLOTS, with_embedded_textures } = require('../src/js/wow/equipment-textures');

// the warglaive model as the Mac log loaded it: 534478 is knife_1h_deathwingraid_e_03.blp
const glaive_textures = [{ fileDataID: 534478 }, { fileDataID: 144333 }, { fileDataID: 0 }, { fileDataID: 534478 }];
const glaive_types = [0, 0, 11, 0];

test('a display with no textures still exports the model\'s own textures', () => {
	assert.deepEqual(with_embedded_textures([], glaive_textures, glaive_types), [0, 0, 0, 534478, 144333]);
	assert.deepEqual(with_embedded_textures(undefined, glaive_textures, glaive_types), [0, 0, 0, 534478, 144333]);
});

test('display textures keep their positions; embedded ones follow, without duplicates', () => {
	assert.deepEqual(with_embedded_textures([7215419, 144333], glaive_textures, glaive_types), [7215419, 144333, 0, 534478]);
	assert.deepEqual(with_embedded_textures([1, 2, 3, 4], glaive_textures, glaive_types), [1, 2, 3, 4, 534478, 144333]);
});

test('replaceable slots and empty files are not added', () => {
	assert.deepEqual(with_embedded_textures([5211540], [{ fileDataID: 0 }, { fileDataID: 99 }], [0, 2]), [5211540]);
	assert.deepEqual(with_embedded_textures([5211540], null, null), [5211540]);
});

test('embedded textures never take a replaceable position (types 2-4 and 11-13 are read by index)', () => {
	// the glaive model has a type-11 slot: with an empty display it must still read nothing
	const list = with_embedded_textures([], glaive_textures, glaive_types);
	assert.equal(REPLACEABLE_SLOTS, 3);
	for (const type of [2, 3, 4])
		assert.ok(!(list[type - 2] > 0), 'type ' + type + ' reads an embedded texture');
	for (const type of [11, 12, 13])
		assert.ok(!(list[type - 11] > 0), 'type ' + type + ' reads an embedded texture');

	// a one-texture display keeps its type-11 texture and nothing else lands on 12 or 13
	const one = with_embedded_textures([5211540], glaive_textures, glaive_types);
	assert.equal(one[0], 5211540);
	assert.ok(!(one[1] > 0) && !(one[2] > 0));
});

test('no embedded textures: the display list comes back unpadded', () => {
	assert.deepEqual(with_embedded_textures([], [{ fileDataID: 7 }], [11]), []);
});
