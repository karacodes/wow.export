/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The character name the print export writes into the sidecar (src/js/ui/character-name.js):
	the saved character's name first, then the armory name, else none.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { character_name } = require('../src/js/ui/character-name');

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
