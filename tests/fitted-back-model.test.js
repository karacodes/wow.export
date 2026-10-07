/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for the mechagnome's flame cape (Kara, 2026-10-07): the cape
	cape_armor_legion_d_01_mg_f.m2 is one of a family of race-fitted models built
	on the character's skeleton, and was pinned to the Back attachment point, which
	lifted it a body-height above her. Race-fitted back models must be skinned to
	the character's bones; race-neutral ones (backpacks) stay attachments.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { BACK_SLOT, is_fitted_back_model } = require('../src/js/wow/fitted-back-model');

const MECHAGNOME = 37, GNOME = 7;

test('the mechagnome female flame cape (7214251, mg_f) is skinned, not attached', () => {
	assert.equal(BACK_SLOT, 15);
	assert.equal(is_fitted_back_model(15, { raceID: MECHAGNOME, genderIndex: 1 }), true);
	assert.equal(is_fitted_back_model(15, { raceID: GNOME, genderIndex: 0 }), true);
});

test('race-neutral back models stay attachments (the Wrathion backpack has no race row)', () => {
	assert.equal(is_fitted_back_model(15, null), false);
	assert.equal(is_fitted_back_model(15, undefined), false);
	assert.equal(is_fitted_back_model(15, { raceID: 0, genderIndex: 2 }), false);
});

test('other slots keep their attachment points even for race-specific models (helmets)', () => {
	assert.equal(is_fitted_back_model(1, { raceID: MECHAGNOME, genderIndex: 1 }), false);
	assert.equal(is_fitted_back_model(16, { raceID: GNOME, genderIndex: 0 }), false);
});
