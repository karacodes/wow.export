/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The class gate on character customization (src/js/ui/customization-class.js):
	with Class = Other the demon-hunter-only options and choices are out, with
	Class = Demon Hunter they are in. Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASS_DEMON_HUNTER, CLASS_OTHER, class_bit, is_allowed_for_class, filter_for_class } = require('../src/js/ui/customization-class');

const DH = class_bit(CLASS_DEMON_HUNTER);   // 1 << 11
const WARLOCK = class_bit(9);
const EVOKER = class_bit(13);

test('no class requirement: listed for every class', () => {
	assert.equal(is_allowed_for_class(0, CLASS_OTHER), true);
	assert.equal(is_allowed_for_class(0, CLASS_DEMON_HUNTER), true);
	assert.equal(is_allowed_for_class(undefined, CLASS_OTHER), true);
});

test('demon hunter only (horns, blindfold, tattoo): out for Other, in for Demon Hunter', () => {
	assert.equal(is_allowed_for_class(DH, CLASS_OTHER), false);
	assert.equal(is_allowed_for_class(DH, CLASS_DEMON_HUNTER), true);
});

test('Other is any class but a demon hunter: a mask that allows some other class stays listed', () => {
	assert.equal(is_allowed_for_class(DH | WARLOCK, CLASS_OTHER), true);
	assert.equal(is_allowed_for_class(EVOKER, CLASS_OTHER), true);
	assert.equal(is_allowed_for_class(EVOKER, CLASS_DEMON_HUNTER), false);
});

test('filter_for_class keeps the entries the class may use, in order', () => {
	const choices = [
		{ id: 1, label: 'None', class_mask: 0 },
		{ id: 2, label: 'Curled horns', class_mask: DH },
		{ id: 3, label: 'Swept horns', class_mask: DH }
	];
	assert.deepEqual(filter_for_class(choices, CLASS_OTHER).map(c => c.id), [1]);
	assert.deepEqual(filter_for_class(choices, CLASS_DEMON_HUNTER).map(c => c.id), [1, 2, 3]);
	assert.equal(filter_for_class(undefined, CLASS_OTHER), undefined);
});
