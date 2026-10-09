/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Geosets picked by hand in Custom Geoset Control survive refreshes and saved characters
	(src/js/wow/geoset-overrides.js, wow-to-stl #121). Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const picks = require('../src/js/wow/geoset-overrides');

// a body with three hairstyles (geosets 1-3) and three sleeve lengths (801-803)
const make_rows = () => [0, 1, 2, 3, 801, 802, 803].map(id => ({ id, checked: false }));

// what customization and gear give: the body, the chosen hairstyle and sleeve length
const look = (hair, sleeves) => rows => {
	for (const row of rows)
		row.checked = row.id === 0 || row.id === hair || row.id === 800 + sleeves;
};

const checked = rows => rows.filter(row => row.checked).map(row => row.id);
const untick = (rows, id) => { rows.find(row => row.id === id).checked = false; };
const tick = (rows, id) => { rows.find(row => row.id === id).checked = true; };

// the saved character file, written and read back as text the way My Characters does
const save_and_load = (state, rows, model_id) => {
	const data = { model_id, choices: [] };
	const saved = picks.to_save(picks.current(state, rows));
	if (saved)
		data.geoset_overrides = saved;
	return JSON.parse(JSON.stringify(data));
};

test('a geoset unticked by hand comes back unticked when the saved character is loaded', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	assert.deepEqual(checked(rows), [0, 2, 801]);

	untick(rows, 2); // the hair, by hand
	tick(rows, 803); // and the long sleeves
	const file = save_and_load(state, rows, 7);
	assert.deepEqual(file.geoset_overrides, { show: [803], hide: [2] });

	// a fresh start: the app reopened, the save loaded from My Characters (or by the print batch)
	const loaded = picks.create_state();
	const new_rows = make_rows();
	picks.queue_save(loaded, file);
	picks.start_character(loaded, 7);
	picks.refresh(loaded, new_rows, look(2, 1));
	assert.deepEqual(checked(new_rows), [0, 801, 803]);
});

test('a save with no hand picks writes no geoset_overrides, and an old save loads as before', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	assert.equal('geoset_overrides' in save_and_load(state, rows, 7), false);

	const loaded = picks.create_state();
	const new_rows = make_rows();
	picks.queue_save(loaded, { model_id: 7, choices: [] });
	picks.start_character(loaded, 7);
	picks.refresh(loaded, new_rows, look(2, 1));
	assert.deepEqual(checked(new_rows), [0, 2, 801]);
});

test('a hand pick stays through a refresh that changes another group', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	untick(rows, 2);

	picks.refresh(state, rows, look(2, 3)); // new gear: longer sleeves
	assert.deepEqual(checked(rows), [0, 803]);
	assert.deepEqual(picks.to_save(picks.current(state, rows)), { show: [], hide: [2] });
});

test('a new choice in the same group wins over the hand pick', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	untick(rows, 2);

	picks.refresh(state, rows, look(3, 1)); // a new hairstyle picked in the customization list
	assert.deepEqual(checked(rows), [0, 3, 801]);
	assert.equal(picks.current(state, rows).size, 0);
});

test('hand picks carry to a new model of the same character (a conditional model swap)', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	untick(rows, 2);
	picks.refresh(state, rows, look(2, 1));

	const swapped = make_rows();
	picks.refresh(state, swapped, look(2, 1));
	assert.deepEqual(checked(swapped), [0, 801]);
});

test('another character or body type starts with no hand picks', () => {
	const state = picks.create_state();
	const rows = make_rows();
	picks.start_character(state, 7);
	picks.refresh(state, rows, look(2, 1));
	untick(rows, 2);

	picks.start_character(state, 8);
	picks.refresh(state, rows, look(2, 1));
	assert.deepEqual(checked(rows), [0, 2, 801]);
});

test('a queued save waits for its own model and is used once', () => {
	const state = picks.create_state();
	picks.queue_save(state, { model_id: 7, geoset_overrides: { show: [], hide: [2] } });

	picks.start_character(state, 8); // a body type on the way to the save's model
	assert.equal(state.overrides.size, 0);
	assert.notEqual(state.pending, null);

	picks.start_character(state, 7);
	assert.deepEqual([...state.overrides], [[2, false]]);
	assert.equal(state.pending, null);

	picks.start_character(state, 7); // the user picks the same body type again later
	assert.equal(state.overrides.size, 0);
});

test('malformed geoset_overrides are ignored', () => {
	assert.equal(picks.from_save(undefined).size, 0);
	assert.equal(picks.from_save('2').size, 0);
	assert.deepEqual([...picks.from_save({ show: [5, '6', -1, 1.5, null], hide: 'all' })], [[5, true]]);
	assert.deepEqual([...picks.from_save({ show: [5], hide: [5, 6] })], [[5, true], [6, false]]);
	assert.equal(picks.to_save(new Map()), undefined);
});
