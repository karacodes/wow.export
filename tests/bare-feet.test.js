/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #227: barefoot races (ChrRaces flag 0x2, e.g. tauren
	hooves) got the boots' texture painted on their feet. Seen in the standard test set
	exported 2026-10-13: tauren and highmountain tauren of both sexes carry the Judgment
	Sabatons' (16957) layer plate_raidpaladin_b_01_boot_fo_u on the foot section.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { RACE_FLAG_DO_NOT_COMPONENT_FEET, FOOT_SECTION, is_bare_feet, body_item_textures } = require('../src/js/wow/bare-feet');

// the Judgment Sabatons' body textures as DBItemCharTextures returns them: lower leg and foot
const sabatons = [{ section: 6, fileDataID: 1001 }, { section: FOOT_SECTION, fileDataID: 1002 }];

test('ChrRaces flag 0x2 marks a barefoot race, whatever else is set', () => {
	assert.equal(RACE_FLAG_DO_NOT_COMPONENT_FEET, 0x2);
	assert.equal(is_bare_feet(0x2), true);
	assert.equal(is_bare_feet(0x2 | 0x1 | 0x40), true);
	assert.equal(is_bare_feet(0x1), false);
	assert.equal(is_bare_feet(0), false);
	assert.equal(is_bare_feet(undefined), false);
});

test('a barefoot race gets no item texture on the foot section', () => {
	assert.equal(FOOT_SECTION, 7);
	assert.deepEqual(body_item_textures(sabatons, true), [{ section: 6, fileDataID: 1001 }]);
});

test('other races keep every section, and an empty lookup stays empty', () => {
	assert.equal(body_item_textures(sabatons, false), sabatons);
	assert.equal(body_item_textures(null, true), null);
	assert.equal(body_item_textures(undefined, true), undefined);
});

// the viewers cannot load outside nw.js, so check that every place compositing item
// textures onto the body goes through body_item_textures
test('the characters and creatures tabs drop foot textures for barefoot races', () => {
	const read = file => fs.readFileSync(path.join(__dirname, '..', 'src', 'js', file), 'utf8');
	const lookups = /DBItemCharTextures\.(getItemTextures|getTexturesByDisplayId)\(/g;

	for (const [file, expected] of [['modules/tab_characters.js', 1], ['modules/tab_creatures.js', 2]]) {
		const source = read(file);
		const wrapped = source.match(/body_item_textures\(/g) || [];
		const races = source.match(/DBCharacterCustomization\.is_race_bare_feet\(/g) || [];
		assert.equal(wrapped.length, expected, file + ': item texture lookups not filtered for bare feet');
		assert.equal(races.length, expected, file + ': race bare-feet flag not read');

		// each lookup sits inside a body_item_textures( call in its own statement (creatures
		// pick one of two lookups)
		for (const match of source.matchAll(lookups)) {
			const statement = source.slice(source.lastIndexOf(';', match.index) + 1, match.index);
			assert.match(statement, /body_item_textures\(/, file + ': ' + match[0] + ' is not filtered');
		}
	}

	const customization = read('db/caches/DBCharacterCustomization.js');
	assert.match(customization, /bareFeet: is_bare_feet\(flags\)/);
});
