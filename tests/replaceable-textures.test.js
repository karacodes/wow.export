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

/*
	The loader: DBItemDisplayInfoModelMatRes builds every display's lists with
	model_texture_lists, and DBItemModels picks a model's list by its real slot with
	model_textures_for_slots. Rows below are the game's (wago.tools, build 12.1.7).
*/
const { model_texture_lists, model_textures_for_slots } = require('../src/js/wow/replaceable-textures');

// MaterialResourcesID -> TextureFileData files (usage 0)
const files = new Map([
	[651795, [3055491]],             // the rucksack's only material
	[1059489, [7215419]], [1059493, [7215423]], // hm-cape 253340, display 714652
	[657442, [3180240]],             // Black Dragonscale Backpack 174361, display 698054
	[100, [1001]], [400, [4001]]     // a display with types 2 and 4, no 3
]);
const lookup = id => files.get(id);
const rows = [
	{ ID: 118841, MaterialResourcesID: 651795, TextureType: 3, ModelIndex: 0, ItemDisplayInfoID: 677171 },
	{ ID: 197096, MaterialResourcesID: 1059493, TextureType: 3, ModelIndex: 0, ItemDisplayInfoID: 714652 },
	{ ID: 197095, MaterialResourcesID: 1059489, TextureType: 2, ModelIndex: 0, ItemDisplayInfoID: 714652 },
	{ ID: 177472, MaterialResourcesID: 657442, TextureType: 2, ModelIndex: 1, ItemDisplayInfoID: 698054 },
	{ ID: 1, MaterialResourcesID: 400, TextureType: 4, ModelIndex: 0, ItemDisplayInfoID: 9 },
	{ ID: 2, MaterialResourcesID: 100, TextureType: 2, ModelIndex: 0, ItemDisplayInfoID: 9 },
	{ ID: 3, MaterialResourcesID: 999, TextureType: 2, ModelIndex: 0, ItemDisplayInfoID: 10 } // no TextureFileData row
];

test('loader: the rucksack display gets [0, 3055491] for its model', () => {
	const lists = model_texture_lists(rows, lookup);
	assert.deepEqual(lists.get(677171), [[0, 3055491]]);
});

test('loader: full sets are unchanged (hm-cape), and a 2 + 4 set keeps the gap', () => {
	const lists = model_texture_lists(rows, lookup);
	assert.deepEqual(lists.get(714652), [[7215419, 7215423]]);
	assert.deepEqual(lists.get(9), [[1001, 0, 4001]]);
	assert.equal(lists.has(10), false);
});

test('loader: a model in slot 1 (Black Dragonscale Backpack) finds its list by slot', () => {
	const lists = model_texture_lists(rows, lookup).get(698054);
	assert.equal(lists[0], undefined);
	assert.deepEqual(lists[1], [3180240]);
	// DBItemModels keeps one model, from slot 1: model_resource_slots([0, 56422]) = [1]
	assert.deepEqual(model_textures_for_slots([1], slot => lists[slot]), [[3180240]]);
	assert.deepEqual(model_textures_for_slots([0, 1], slot => lists[slot]), [[], [3180240]]);
});
