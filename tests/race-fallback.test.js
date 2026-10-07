/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for the mechagnome flame cape (Kara, 2026-10-07): an allied race
	with no variant of an item model of its own must take its ChrRaces fallback
	race's variant (mechagnome -> gnome), not the first one in the list (human),
	which renders at human height. Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { build_fallback_chain, as_chain, race_rank, pick_model_variant, MAX_CHAIN } = require('../src/js/wow/race-fallback');

const HUMAN = 1, GNOME = 7, MECHAGNOME = 37, DWARF = 3, DARK_IRON = 34;
const MALE = 0, FEMALE = 1;
const GENDER_ANY = 2; // ComponentModelFileData.GenderIndex for either gender

// ChrRaces.*ModelFallbackRaceID as the game ships them (allied race -> core race)
const links = {
	[MECHAGNOME]: { raceID: GNOME, genderIndex: null },
	[DARK_IRON]: { raceID: DWARF, genderIndex: null }
};
const next = (race, gender) => links[race] ? { raceID: links[race].raceID, genderIndex: gender } : null;

// a cape with a model per core race and gender, human first (the ItemDisplayInfo order)
const cape_models = [
	{ fdid: 101, info: { raceID: HUMAN, genderIndex: MALE } },
	{ fdid: 102, info: { raceID: HUMAN, genderIndex: FEMALE } },
	{ fdid: 107, info: { raceID: GNOME, genderIndex: MALE } },
	{ fdid: 108, info: { raceID: GNOME, genderIndex: FEMALE } },
	{ fdid: 103, info: { raceID: DWARF, genderIndex: GENDER_ANY } }
];

test('fallback chain: mechagnome female -> gnome female, nothing after a race without a link', () => {
	assert.deepEqual(build_fallback_chain(MECHAGNOME, FEMALE, next), [{ raceID: GNOME, genderIndex: FEMALE }]);
	assert.deepEqual(build_fallback_chain(GNOME, FEMALE, next), []);
	assert.deepEqual(build_fallback_chain(HUMAN, MALE, next), []);
});

test('fallback chain: a cycle or a long chain stops', () => {
	const loop = (race, gender) => ({ raceID: race === 1 ? 2 : 1, genderIndex: gender });
	assert.deepEqual(build_fallback_chain(1, MALE, loop), [{ raceID: 2, genderIndex: MALE }]);

	const endless = (race, gender) => ({ raceID: race + 1, genderIndex: gender });
	assert.equal(build_fallback_chain(1, MALE, endless).length, MAX_CHAIN);
});

test('mechagnome female takes the gnome female cape, not the human one', () => {
	const chain = build_fallback_chain(MECHAGNOME, FEMALE, next);
	assert.equal(pick_model_variant(cape_models, MECHAGNOME, FEMALE, chain, GENDER_ANY), 108);
	assert.equal(pick_model_variant(cape_models, MECHAGNOME, MALE, build_fallback_chain(MECHAGNOME, MALE, next), GENDER_ANY), 107);
});

test('a fallback race with a generic-gender entry still matches', () => {
	const chain = build_fallback_chain(DARK_IRON, FEMALE, next);
	assert.equal(pick_model_variant(cape_models, DARK_IRON, FEMALE, chain, GENDER_ANY), 103);
});

test('own race wins over the fallback; no race at all falls back to any-race, then the first', () => {
	assert.equal(pick_model_variant(cape_models, GNOME, MALE, [{ raceID: HUMAN, genderIndex: MALE }], GENDER_ANY), 107);

	const with_generic = [...cape_models, { fdid: 100, info: { raceID: 0, genderIndex: GENDER_ANY } }];
	assert.equal(pick_model_variant(with_generic, 99, MALE, [], GENDER_ANY), 100);
	assert.equal(pick_model_variant(cape_models, 99, MALE, [], GENDER_ANY), 101);
	assert.equal(pick_model_variant([], 99, MALE, [], GENDER_ANY), null);
});

test('as_chain accepts a chain, a bare race id, or nothing', () => {
	assert.deepEqual(as_chain([{ raceID: GNOME, genderIndex: FEMALE }], MALE), [{ raceID: GNOME, genderIndex: FEMALE }]);
	assert.deepEqual(as_chain(GNOME, FEMALE), [{ raceID: GNOME, genderIndex: FEMALE }]);
	assert.deepEqual(as_chain(0, MALE), []);
	assert.deepEqual(as_chain(undefined, MALE), []);
});

test('texture ranking: own race, then fallback races in order, then the rest', () => {
	const chain = [{ raceID: GNOME, genderIndex: FEMALE }, { raceID: HUMAN, genderIndex: FEMALE }];
	assert.equal(race_rank(MECHAGNOME, MECHAGNOME, chain), 0);
	assert.ok(race_rank(GNOME, MECHAGNOME, chain) < race_rank(HUMAN, MECHAGNOME, chain));
	assert.ok(race_rank(HUMAN, MECHAGNOME, chain) < race_rank(DWARF, MECHAGNOME, chain));
});
