/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The character name the print export writes into the sidecar (src/js/ui/character-name.js):
	the saved character's name first, then the armory name, else none.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { character_name, armory_for_save, armory_from_save, save_name_suggestion } = require('../src/js/ui/character-name');

test('a saved character is named by its save', () => {
	assert.deepEqual(character_name('Lockspanner', null), { name: 'Lockspanner', source: 'saved' });
});

test('the saved name wins over the armory name', () => {
	assert.deepEqual(character_name('Lockspanner', 'manatorque'), { name: 'Lockspanner', source: 'saved' });
});

test('an armory import without a save is named by the armory', () => {
	assert.deepEqual(character_name(null, 'Manatorque'), { name: 'Manatorque', source: 'armory' });
	assert.deepEqual(character_name('   ', 'Manatorque'), { name: 'Manatorque', source: 'armory' });
});

test('a character built by hand has no name', () => {
	assert.deepEqual(character_name(null, null), { name: null, source: null });
	assert.deepEqual(character_name('', '  '), { name: null, source: null });
	assert.deepEqual(character_name(undefined, undefined), { name: null, source: null });
});

test('names are trimmed', () => {
	assert.deepEqual(character_name('  Lockspanner ', null), { name: 'Lockspanner', source: 'saved' });
});

// F14 (Kara 2026-10-08): a Battle.net import's name, realm and region go into the save and come back

test('an imported character saves its armory name, realm and region', () => {
	assert.deepEqual(armory_for_save('Manatorque', 'wyrmrest-accord', 'us'), { name: 'Manatorque', realm: 'wyrmrest-accord', region: 'us' });
	assert.deepEqual(armory_for_save(' Manatorque ', '', null), { name: 'Manatorque', realm: null, region: null });
});

test('a character that was never imported saves no armory block', () => {
	assert.equal(armory_for_save(null, 'wyrmrest-accord', 'us'), null);
	assert.equal(armory_for_save('  ', null, null), null);
});

test('loading a save brings the armory name, realm and region back', () => {
	const data = { realm: 'wyrmrest-accord', armory: { name: 'Manatorque', realm: 'wyrmrest-accord', region: 'us' } };
	assert.deepEqual(armory_from_save(data), { name: 'Manatorque', realm: 'wyrmrest-accord', region: 'us' });
	// what get_current_character_data writes round-trips
	const saved = { realm: 'wyrmrest-accord', armory: armory_for_save('Shortshank', 'wyrmrest-accord', 'us') };
	assert.deepEqual(armory_from_save(JSON.parse(JSON.stringify(saved))), { name: 'Shortshank', realm: 'wyrmrest-accord', region: 'us' });
});

test('a save from before F14 keeps its realm and has no armory name', () => {
	assert.deepEqual(armory_from_save({ realm: 'wyrmrest-accord' }), { name: null, realm: 'wyrmrest-accord', region: null });
	assert.deepEqual(armory_from_save({}), { name: null, realm: null, region: null });
	assert.deepEqual(armory_from_save(null), { name: null, realm: null, region: null });
	assert.deepEqual(armory_from_save({ armory: 'junk' }), { name: null, realm: null, region: null });
});

test('the Save box starts with the saved name, else the imported name', () => {
	assert.equal(save_name_suggestion(null, 'Manatorque'), 'Manatorque');
	assert.equal(save_name_suggestion('Lockspanner', 'Manatorque'), 'Lockspanner');
	assert.equal(save_name_suggestion(null, null), '');
});
