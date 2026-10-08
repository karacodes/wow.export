/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The animation drop-down's search box (src/js/wow/animation-filter.js, F13).
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { filter_animations } = require('../src/js/wow/animation-filter');

// labels as tab_characters builds them: AnimMapper name + (id.variation)
const ANIMS = [
	{ id: 'none', label: 'No Animation' },
	{ id: '0.0', label: 'Stand (0.0)' },
	{ id: '16.0', label: 'AttackUnarmed (16.0)' },
	{ id: '17.0', label: 'Attack1H (17.0)' },
	{ id: '18.0', label: 'Attack2H (18.0)' },
	{ id: '26.0', label: 'ReadyUnarmed (26.0)' },
	{ id: '27.0', label: 'Ready1H (27.0)' },
	{ id: '160.1', label: 'Attack1HPierce (160.1)' }
];
const ids = (list) => list.map(a => a.id);

test('an empty search shows every animation', () => {
	assert.equal(filter_animations(ANIMS, '').length, ANIMS.length);
	assert.equal(filter_animations(ANIMS, '   ').length, ANIMS.length);
	assert.equal(filter_animations(ANIMS, undefined).length, ANIMS.length);
});

test('any part of the name matches, in any case', () => {
	assert.deepEqual(ids(filter_animations(ANIMS, 'attack')), ['none', '16.0', '17.0', '18.0', '160.1']);
	assert.deepEqual(ids(filter_animations(ANIMS, 'UNARMED')), ['none', '16.0', '26.0']);
});

test('every word typed has to match', () => {
	assert.deepEqual(ids(filter_animations(ANIMS, 'attack 1h')), ['none', '17.0', '160.1']);
	assert.deepEqual(ids(filter_animations(ANIMS, '1h ready')), ['none', '27.0']);
});

test('the id matches too', () => {
	assert.deepEqual(ids(filter_animations(ANIMS, '(16.')), ['none', '16.0']);
	assert.deepEqual(ids(filter_animations(ANIMS, '16')), ['none', '16.0', '160.1']);
	assert.deepEqual(ids(filter_animations(ANIMS, '160.1')), ['none', '160.1']);
});

test('No Animation and the animation chosen now always stay in the list', () => {
	assert.deepEqual(ids(filter_animations(ANIMS, 'ready', '0.0')), ['none', '0.0', '26.0', '27.0']);
	assert.deepEqual(ids(filter_animations(ANIMS, 'nothing like this', '0.0')), ['none', '0.0']);
});

test('a missing list is an empty list', () => {
	assert.deepEqual(filter_animations(null, 'attack'), []);
});
