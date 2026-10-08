/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Randomize Equipment (src/js/wow/random-equipment.js, F11): a roll puts on one
	item set with 4+ visible armour pieces, both shoulders, one shared appearance
	variant, and leaves weapons, shirt, tabard and the set's missing slots alone.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { armour_pieces, eligible_sets, roll_set_outfit, apply_outfit } = require('../src/js/wow/random-equipment');

// item id -> slot: 1xx head, 3xx shoulder, 5xx chest, 6xx waist, 7xx legs, 8xx feet,
// 9xx wrist, 10xx hands, 15xx back, 16xx main hand, 4xx shirt, 19xx tabard, 11xx ring (no slot)
const SLOT_BY_PREFIX = { 1: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 15: 15, 16: 16, 19: 19 };
const slot_of = (id) => SLOT_BY_PREFIX[Math.floor(id / 100)] ?? null;
const INVISIBLE = new Set([701, 801]);
const is_visible = (id) => !INVISIBLE.has(id);

// a seeded generator so the draws are repeatable
const seeded = (seed) => () => {
	seed = (seed * 1103515245 + 12345) % 2147483648;
	return seed / 2147483648;
};

test('armour pieces: weapons, shirt, tabard, rings and invisible items are not pieces', () => {
	const pieces = armour_pieces([101, 301, 401, 1601, 1901, 1101, 701, 0], slot_of, is_visible);
	assert.deepEqual([...pieces.keys()].sort((a, b) => a - b), [1, 3]);
});

test('armour pieces: two items for one slot are one piece with two choices', () => {
	const pieces = armour_pieces([501, 502, 101], slot_of, is_visible);
	assert.equal(pieces.size, 2);
	assert.deepEqual(pieces.get(5), [501, 502]);
});

test('eligible sets need four visible armour pieces, counted per slot', () => {
	const sets = [
		{ id: 1, name: 'Four', item_ids: [101, 301, 501, 601] },
		{ id: 2, name: 'Three plus weapon and shirt', item_ids: [101, 301, 501, 1601, 401] },
		{ id: 3, name: 'Two invisible', item_ids: [101, 301, 701, 801, 501] },
		{ id: 4, name: 'Two chests', item_ids: [101, 301, 501, 502] }
	];
	assert.deepEqual(eligible_sets(sets, slot_of, is_visible).map(s => s.id), [1]);
});

test('a roll draws one set and one item per slot it covers', () => {
	const sets = eligible_sets([
		{ id: 1, name: 'A', item_ids: [101, 301, 501, 601, 1001] },
		{ id: 2, name: 'B', item_ids: [102, 302, 502, 602] }
	], slot_of, is_visible);

	for (let seed = 1; seed < 50; seed++) {
		const outfit = roll_set_outfit(sets, () => [], seeded(seed));
		const ids = Object.values(outfit.items);
		const set_items = outfit.set.id === 1 ? [101, 301, 501, 601, 1001] : [102, 302, 502, 602];
		assert.ok(ids.every(id => set_items.includes(id)), `seed ${seed}: items from one set`);
		assert.equal(ids.length, outfit.set.pieces.size);
	}
});

test('no eligible set: no roll', () => {
	assert.equal(roll_set_outfit([], () => []), null);
});

test('one variant for the whole set; a piece without it keeps its first look', () => {
	// head and shoulders have normal (0) and heroic (1); chest and waist only normal
	const modifiers = { 101: [0, 1], 301: [0, 1], 501: [0], 601: [0] };
	const sets = eligible_sets([{ id: 1, name: 'A', item_ids: [101, 301, 501, 601] }], slot_of, is_visible);

	const seen = new Set();
	for (let seed = 1; seed < 60; seed++) {
		const outfit = roll_set_outfit(sets, (id) => modifiers[id], seeded(seed));
		seen.add(outfit.variant);
		if (outfit.variant === 1)
			assert.deepEqual(outfit.skins, { 1: 1, 3: 1 });
		else
			assert.deepEqual(outfit.skins, { 1: 0, 3: 0, 5: 0, 6: 0 });
	}
	assert.deepEqual([...seen].sort(), [0, 1], 'both variants come up');
});

test('items with no variants get no skin', () => {
	const sets = eligible_sets([{ id: 1, name: 'A', item_ids: [101, 301, 501, 601] }], slot_of, is_visible);
	const outfit = roll_set_outfit(sets, () => [], seeded(3));
	assert.equal(outfit.variant, undefined);
	assert.deepEqual(outfit.skins, {});
});

test('apply: shoulders on both sides, other slots keep their item and skin, set slots lose an old skin', () => {
	const equipped = { 1: 999, 3: 998, 30: 997, 4: 400, 16: 1600, 17: 1700, 19: 1900, 8: 800 };
	const skins = { 1: 3, 16: 1, 8: 4 };
	const outfit = { items: { 1: 101, 3: 301, 5: 501, 6: 601 }, skins: { 3: 1 } };

	const result = apply_outfit(equipped, skins, outfit);
	assert.deepEqual(result.equipped, { 1: 101, 3: 301, 30: 301, 4: 400, 5: 501, 6: 601, 8: 800, 16: 1600, 17: 1700, 19: 1900 });
	assert.deepEqual(result.skins, { 3: 1, 30: 1, 16: 1, 8: 4 });

	// the old objects are untouched (the viewer watches for new ones)
	assert.equal(equipped[1], 999);
	assert.equal(skins[1], 3);
});
