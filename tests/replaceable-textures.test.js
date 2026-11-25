/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for Renowned Explorer's Rucksack (wow-to-stl #319, upstream issue
	520). Its display (677171) has one ItemDisplayInfoModelMatRes row: texture type 3,
	file 3055491. The model's texture slots are type 2, type 0 and type 3; the backpack
	mesh draws with type 3. The packed list put 3055491 on type 2 and left the backpack
	blank. Entry n of the list must be texture type n + 2.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { variant_textures_by_type, variant_textures_from_type_map } = require('../src/js/wow/replaceable-textures');

test('the rucksack\'s only texture (type 3) stays on type 3, type 2 is empty', () => {
	const list = variant_textures_by_type([{ textureType: 3, textureFileDataIDs: [3055491] }]);
	assert.deepEqual(list, [0, 3055491]);
	assert.equal(list[3 - 2], 3055491);
	assert.equal(list[2 - 2], 0);
});

test('a display with types 2 and 4 and no 3 keeps the handle on type 4', () => {
	assert.deepEqual(variant_textures_by_type([
		{ textureType: 2, textureFileDataIDs: [100] },
		{ textureType: 4, textureFileDataIDs: [400] }
	]), [100, 0, 400]);
});

test('full sets keep their order whatever the row order', () => {
	assert.deepEqual(variant_textures_by_type([
		{ textureType: 3, textureFileDataIDs: [7215423] },
		{ textureType: 2, textureFileDataIDs: [7215419] }
	]), [7215419, 7215423]);
});

test('types the renderer does not read (5, 24) do not take a slot', () => {
	assert.deepEqual(variant_textures_by_type([
		{ textureType: 2, textureFileDataIDs: [751800] },
		{ textureType: 24, textureFileDataIDs: [751801] }
	]), [751800]);
	assert.deepEqual(variant_textures_by_type([{ textureType: 5, textureFileDataIDs: [1] }]), []);
});

test('a type listed twice keeps its first texture; empty files are skipped', () => {
	assert.deepEqual(variant_textures_by_type([
		{ textureType: 2, textureFileDataIDs: [0, 11] },
		{ textureType: 2, textureFileDataIDs: [22] },
		{ textureType: 3, textureFileDataIDs: [] }
	]), [11]);
	assert.deepEqual(variant_textures_by_type(undefined), []);
});

test('the fallback by type map gives the same list', () => {
	assert.deepEqual(variant_textures_from_type_map({ 3: [3055491] }), [0, 3055491]);
	assert.deepEqual(variant_textures_from_type_map({ 2: [3180240] }), [3180240]);
	assert.deepEqual(variant_textures_from_type_map(undefined), []);
});
