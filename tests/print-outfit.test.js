/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Outfit files for the unattended print export (src/js/wow/print-outfit.js, #107).
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const outfit_lib = require('../src/js/wow/print-outfit');
const { SHOULDER_SLOT_L, SHOULDER_SLOT_R } = require('../src/js/wow/EquipmentSlots');

const STANDARD = {
	name: 'standard',
	items: { 'Shoulder': 16953, 'Chest': 16958, 'Main-hand': 128870, 'Off-hand': 1168 },
	passes: { cloak: { Back: 253340 }, backpack: { Back: 174361 } },
	skipRaces: ['Dracthyr', 75]
};

test('slot names are read in any case and spelling, and slot ids as numbers', () => {
	assert.deepEqual(outfit_lib.slot_ids_for_key('Main-hand'), [16]);
	assert.deepEqual(outfit_lib.slot_ids_for_key('main hand'), [16]);
	assert.deepEqual(outfit_lib.slot_ids_for_key('OFFHAND'), [17]);
	assert.deepEqual(outfit_lib.slot_ids_for_key('Shoulder'), [SHOULDER_SLOT_L, SHOULDER_SLOT_R]);
	assert.deepEqual(outfit_lib.slot_ids_for_key('Shoulder (R)'), [SHOULDER_SLOT_R]);
	assert.deepEqual(outfit_lib.slot_ids_for_key('15'), [15]);
	assert.equal(outfit_lib.slot_ids_for_key('11'), null); // a ring: never drawn
	assert.equal(outfit_lib.slot_ids_for_key('Ears'), null);
});

test('each pass wears the shared items plus its own', () => {
	const outfit = outfit_lib.parse_outfit(JSON.stringify(STANDARD));
	assert.deepEqual(outfit.errors, []);
	assert.deepEqual(outfit.passes.map(p => p.name), ['cloak', 'backpack']);

	const cloak = outfit_lib.pass_equipment(outfit, 'cloak');
	assert.deepEqual(cloak.equipment, { [SHOULDER_SLOT_L]: 16953, [SHOULDER_SLOT_R]: 16953, 5: 16958, 16: 128870, 17: 1168, 15: 253340 });
	assert.deepEqual(cloak.skins, {});

	const backpack = outfit_lib.pass_equipment(outfit, 'backpack');
	assert.equal(backpack.equipment[15], 174361);
	// the rest of the outfit is the same in both passes
	assert.deepEqual({ ...backpack.equipment, 15: 0 }, { ...cloak.equipment, 15: 0 });

	assert.deepEqual(outfit_lib.pass_equipment(outfit), cloak, 'no pass named: the first');
	assert.equal(outfit_lib.pass_equipment(outfit, 'tabard'), null);
});

test('a file with no passes has one, named outfit; a pass can empty a slot', () => {
	const plain = outfit_lib.parse_outfit({ items: { Head: 228858 } }, 'my outfit');
	assert.equal(plain.name, 'my-outfit');
	assert.deepEqual(plain.passes.map(p => p.name), ['outfit']);
	assert.deepEqual(outfit_lib.pass_equipment(plain).equipment, { 1: 228858 });

	const bare = outfit_lib.parse_outfit({ items: { Head: 228858, Chest: 16958 }, passes: { helmless: { Head: null } } });
	assert.deepEqual(outfit_lib.pass_equipment(bare, 'helmless').equipment, { 5: 16958 });
});

test('an item can carry its appearance (skin)', () => {
	const outfit = outfit_lib.parse_outfit({ items: { 'Main-hand': { item: 128870, skin: 3 } } });
	assert.deepEqual(outfit_lib.pass_equipment(outfit), { equipment: { 16: 128870 }, skins: { 16: 3 } });
});

test('mistakes in the file are reported, not guessed', () => {
	assert.match(outfit_lib.parse_outfit('{ not json').errors[0], /not valid JSON/);
	assert.deepEqual(outfit_lib.parse_outfit('[]').errors, ['expected a JSON object']);

	const bad = outfit_lib.parse_outfit({ items: { Ears: 1, Chest: 'robe', Legs: -4, Feet: { item: 5, skin: 'red' } }, races: 'all' });
	assert.equal(bad.errors.length, 5);
	assert.deepEqual(outfit_lib.pass_equipment(bad).equipment, {});
});

test('items are checked against the game build: unknown ids fail, odd slots warn', () => {
	const outfit = outfit_lib.parse_outfit({ items: { Chest: 16958, Legs: 16958, 'Off-hand': 128870, 'Shoulder': 16953, Head: 999999 } });
	const slot_of = { 16958: 5, 128870: 16, 16953: SHOULDER_SLOT_L };
	const checked = outfit_lib.check_items(outfit, id => slot_of[id] ?? null);
	assert.deepEqual(checked.errors, ['item 999999 is not in this game build']);
	// a chest piece on the legs warns; a one-hand weapon in the off hand and the right shoulder are fine
	assert.deepEqual(checked.warnings, ['item 16958 is worn in slot 7 but goes in slot 5']);
});

test('races: every playable race, less the skipped ones, by id or by name', () => {
	const playable = [{ id: 10, label: 'Blood Elf' }, { id: 52, label: 'Dracthyr' }, { id: 75, label: 'Dracthyr' }, { id: 7, label: 'Gnome' }, { id: 22, label: 'Worgen' }];
	const outfit = outfit_lib.parse_outfit(STANDARD);
	assert.deepEqual(outfit_lib.select_races(playable, outfit).races.map(r => r.id), [10, 7, 22]);

	const only = outfit_lib.parse_outfit({ items: {}, races: ['blood elf', 'GNOME', 'Murloc'] });
	const picked = outfit_lib.select_races(playable, only);
	assert.deepEqual(picked.races.map(r => r.id), [10, 7]);
	assert.deepEqual(picked.unknown, ['Murloc']);
});

test('one export per pass, race and body type, each in its own folder', () => {
	const outfit = outfit_lib.parse_outfit(STANDARD);
	const races = [{ id: 10, label: 'Blood Elf' }, { id: 34, label: "Dark Iron Dwarf" }];
	const models = { 10: new Map([[1, 102], [0, 101]]), 34: new Map([[0, 341]]) };
	const jobs = outfit_lib.outfit_jobs(outfit, races, id => models[id]);

	assert.deepEqual(jobs.map(j => j.folder), [
		'character/outfit/standard/cloak/blood-elf-male',
		'character/outfit/standard/cloak/blood-elf-female',
		'character/outfit/standard/cloak/dark-iron-dwarf-male',
		'character/outfit/standard/backpack/blood-elf-male',
		'character/outfit/standard/backpack/blood-elf-female',
		'character/outfit/standard/backpack/dark-iron-dwarf-male'
	]);
	assert.deepEqual(jobs.slice(0, 3).map(j => j.chrModelID), [101, 102, 341]);
	assert.equal(jobs[1].label, 'standard/cloak: Blood Elf female');
});

test('two races with one name never share a folder', () => {
	const outfit = outfit_lib.parse_outfit({ items: {} });
	const races = [{ id: 22, label: 'Worgen' }, { id: 23, label: 'Worgen' }];
	const jobs = outfit_lib.outfit_jobs(outfit, races, () => new Map([[0, 1]]));
	assert.deepEqual(jobs.map(j => j.folder), ['character/outfit/outfit/outfit/worgen-male', 'character/outfit/outfit/outfit/worgen-23-male']);
});

test('folder names keep letters, digits and dashes only', () => {
	assert.equal(outfit_lib.outfit_folder('Standard Set!', 'Cloak', "Zandalari Troll", 1), 'character/outfit/standard-set/cloak/zandalari-troll-female');
	assert.equal(outfit_lib.outfit_folder('', '', "Kul Tiran", 0), 'character/outfit/outfit/outfit/kul-tiran-male');
	assert.equal(outfit_lib.sex_label(2), 'type-3');
});
