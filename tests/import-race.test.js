/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Guard test for wow-to-stl #231: a Battle.net worgen imported with "Load visage model"
	must load race 23 (Gilnean, the worgen's human form), not race 1 (human). Upstream PR
	#599 proposes 23 -> 1. The game tables say otherwise: Worgen's
	UnalteredVisualCustomizationRaceID is 23, and the armory's human-form choices use race
	23's option ids, which race 1's models do not have. The option ids below are the real
	ones from the 12.1.0 tables read on 2026-10-10 (ChrRaceXChrModel, ChrCustomizationOption).
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { RACE, import_race_id } = require('../src/js/wow/import-race');

const HUMAN = 1;

// ChrRaceXChrModel: race -> [male model, female model]
const RACE_MODELS = { [HUMAN]: [1, 2], [RACE.WORGEN]: [43, 44], [RACE.GILNEAN]: [45, 46] };

// ChrCustomizationOption ids per ChrModel (human and worgen lists cut short)
const MODEL_OPTIONS = {
	1: [9, 10, 11, 12, 13, 463, 525, 888, 889, 890, 6338, 8522, 8789],
	2: [14, 15, 16, 17, 464, 501, 510, 516, 526, 970, 6339, 8523, 8790],
	43: [203, 204, 205, 207, 622, 675, 6360, 8544],
	44: [208, 209, 210, 212, 623, 6361, 8545],
	45: [213, 214, 215, 216, 217],
	46: [218, 219, 220, 221, 382]
};

// a worgen male's armory customizations: both forms (choice ids made up)
const WORGEN_MALE_CHOICES = [
	{ option: 203, choice: 1 }, { option: 204, choice: 2 }, { option: 205, choice: 3 }, { option: 207, choice: 4 },
	{ option: 213, choice: 5 }, { option: 214, choice: 6 }, { option: 215, choice: 7 }, { option: 216, choice: 8 }, { option: 217, choice: 9 }
];

// the filter apply_import_data runs on the armory's list: only the loaded model's options survive
const kept_options = (race_id, sex, choices) => {
	const options = MODEL_OPTIONS[RACE_MODELS[race_id][sex]];
	return choices.filter(c => options.includes(c.option)).map(c => c.option);
};

test('a worgen with "Load visage model" loads the Gilnean race, not human', () => {
	assert.equal(import_race_id(RACE.WORGEN, true), RACE.GILNEAN);
	assert.notEqual(import_race_id(RACE.WORGEN, true), HUMAN);
});

test('the Gilnean race keeps every human-form choice the armory sends; human would drop them all', () => {
	assert.deepEqual(kept_options(import_race_id(RACE.WORGEN, true), 0, WORGEN_MALE_CHOICES), [213, 214, 215, 216, 217]);
	assert.deepEqual(kept_options(HUMAN, 0, WORGEN_MALE_CHOICES), []);
});

test('without the visage box a worgen stays a worgen and keeps its worgen-form choices', () => {
	assert.equal(import_race_id(RACE.WORGEN, false), RACE.WORGEN);
	assert.deepEqual(kept_options(RACE.WORGEN, 0, WORGEN_MALE_CHOICES), [203, 204, 205, 207]);
});

test('dracthyr and pandaren map as before', () => {
	assert.equal(import_race_id(RACE.DRACTHYR_ALLIANCE, false), RACE.DRACTHYR_ALLIANCE);
	assert.equal(import_race_id(RACE.DRACTHYR_HORDE, false), RACE.DRACTHYR_ALLIANCE);
	assert.equal(import_race_id(RACE.DRACTHYR_ALLIANCE, true), RACE.DRACTHYR_VISAGE);
	assert.equal(import_race_id(RACE.DRACTHYR_HORDE, true), RACE.DRACTHYR_VISAGE);
	assert.equal(import_race_id(RACE.PANDAREN_ALLIANCE, true), RACE.PANDAREN_NEUTRAL);
	assert.equal(import_race_id(RACE.PANDAREN_HORDE, false), RACE.PANDAREN_NEUTRAL);
	assert.equal(import_race_id(HUMAN, true), HUMAN);
});

test('the Battle.net import takes its race from import_race_id', () => {
	const tab = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modules', 'tab_characters.js'), 'utf8');
	assert.match(tab, /race_id = import_race_id\(race_id, core\.view\.chrImportLoadVisage\)/);
	assert.doesNotMatch(tab, /race_id = (23|1);/);
});
