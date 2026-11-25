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

/*
	Regression test for Vagabond's Camo Hood (wow-to-stl #316, upstream issue 521): its display
	(655731) has a model only in its second ModelResourcesID slot, one per race and sex, built on
	the character's skeleton. Pinned to the Helm attachment it floated a head-height above every
	race (Kara's 2026-11-25 export run: hood centre at about twice the helm's height). The
	Judgment Crown (16955, display 45888) has its model in the first slot and stays attached.
 */
const { HEAD_SLOT, is_fitted_head_model } = require('../src/js/wow/fitted-back-model');

test('a head model from the second model slot (Vagabond\'s Camo Hood) is skinned, not attached', () => {
	assert.equal(HEAD_SLOT, 1);
	assert.equal(is_fitted_head_model(1, 1), true);
});

test('a head model from the first model slot (Judgment Crown) stays on the Helm attachment', () => {
	assert.equal(is_fitted_head_model(1, 0), false);
});

test('second-slot models of other slots keep their attachment rules (the right shoulder, a weapon)', () => {
	assert.equal(is_fitted_head_model(3, 1), false);
	assert.equal(is_fitted_head_model(16, 1), false);
	assert.equal(is_fitted_head_model(15, 1), false);
});

/*
	The first fix tested the model's index after DBItemModels had dropped the empty
	ModelResourcesID slots, so the hood's only model came out as index 0 and stayed on the Helm
	point (mac-job-2, 2026-11-25: "Loaded attachment model 4260228 for slot 1 attachment 11").
	The slot each model came from is what tells a fitted head model.
 */
const { model_resource_slots } = require('../src/js/wow/fitted-back-model');

test('Vagabond\'s Camo Hood\'s only model resource is in the second slot', () => {
	// ItemDisplayInfo 655731: ModelResourcesID [0, 62770]
	const slots = model_resource_slots([0, 62770]);
	assert.deepEqual(slots, [1]);
	assert.equal(is_fitted_head_model(1, slots[0]), true);
});

test('the Judgment Crown\'s model resource is in the first slot, and shoulders keep both', () => {
	// ItemDisplayInfo 45888: ModelResourcesID [16511, 0]
	const slots = model_resource_slots([16511, 0]);
	assert.deepEqual(slots, [0]);
	assert.equal(is_fitted_head_model(1, slots[0]), false);
	assert.deepEqual(model_resource_slots([16512, 16512]), [0, 1]);
	assert.deepEqual(model_resource_slots(undefined), []);
});
