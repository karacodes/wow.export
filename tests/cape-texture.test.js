/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for the untextured cloak (Kara, 2026-10-07: the gnome male's
	back cape shows no texture): the equipped Back item's cape texture must reach
	the character model as replaceable texture type 2, in the viewer and in the
	exporter's variant textures. Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { BACK_SLOT, CAPE_TEXTURE_TYPE, cape_texture_for_display, character_variant_textures } = require('../src/js/wow/cape-texture');

test('slot and type constants match the game data', () => {
	assert.equal(BACK_SLOT, 15);
	assert.equal(CAPE_TEXTURE_TYPE, 2);
});

test('a plain cloak (textures, no model) binds its texture', () => {
	const display = { models: [], textures: [4150001], texturesByType: {} };
	assert.equal(cape_texture_for_display(display), 4150001);
});

test('a display tagged with a type-2 texture binds that one, model or not', () => {
	const typed = { models: [900001], textures: [4150002, 4150003], texturesByType: { 11: [4150003], 2: [4150002] } };
	assert.equal(cape_texture_for_display(typed), 4150002);

	const typed_no_model = { models: [], textures: [4150003, 4150002], texturesByType: { 2: [4150002] } };
	assert.equal(cape_texture_for_display(typed_no_model), 4150002);
});

test('a 3D back item without a cape texture leaves the cloak geoset alone', () => {
	const backpack = { models: [900001], textures: [4150003], texturesByType: { 11: [4150003] } };
	assert.equal(cape_texture_for_display(backpack), 0);
	assert.equal(cape_texture_for_display(null), 0);
	assert.equal(cape_texture_for_display({ models: [], textures: [] }), 0);
});

test('the exporter variant list puts the cape at type 2', () => {
	assert.deepEqual(character_variant_textures(4150001), [4150001]);
	assert.deepEqual(character_variant_textures(0), [0]);
	assert.deepEqual(character_variant_textures(undefined), [0]);
});
