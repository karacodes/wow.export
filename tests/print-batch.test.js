/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The unattended print export's start-up flags and folders (src/js/wow/print-batch.js, F12).
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse_print_batch_args, realm_slug, character_folder, print_export_folder, select_saved } = require('../src/js/wow/print-batch');

test('no print flag is a normal start', () => {
	assert.equal(parse_print_batch_args([]), null);
	assert.equal(parse_print_batch_args(['--disable-auto-update']), null);
	assert.equal(parse_print_batch_args(undefined), null);
});

test('--print-export-all exports every saved character', () => {
	assert.deepEqual(parse_print_batch_args(['--print-export-all']), { all: true, names: [], imports: [], outfits: [], errors: [] });
});

test('named characters are exported instead of all, each once', () => {
	const batch = parse_print_batch_args(['--print-export=Lockspanner', '--print-export= Wrenz ', '--print-export=lockspanner']);
	assert.deepEqual(batch, { all: false, names: ['Lockspanner', 'Wrenz'], imports: [], outfits: [], errors: [] });
});

test('an armory import is parsed to region, realm slug and name', () => {
	const batch = parse_print_batch_args(['--print-import=EU/Argent Dawn/Manatorque']);
	assert.equal(batch.all, false);
	assert.deepEqual(batch.imports, [{ region: 'eu', realm: 'argent-dawn', name: 'Manatorque' }]);
});

test('imports and all can be combined', () => {
	const batch = parse_print_batch_args(['--print-export-all', '--print-import=us/stormrage/Foo']);
	assert.equal(batch.all, true);
	assert.equal(batch.imports.length, 1);
});

test('bad flags are reported, not guessed', () => {
	const batch = parse_print_batch_args(['--print-export=', '--print-import=us/stormrage', '--print-import=us//Foo']);
	assert.equal(batch.errors.length, 3);
	assert.deepEqual(batch.names, []);
	assert.deepEqual(batch.imports, []);
});

test('a rejected name or import flag never widens the run to every saved character', () => {
	assert.equal(parse_print_batch_args(['--print-export=']).all, false);
	assert.equal(parse_print_batch_args(['--print-import=eu/argent-dawn']).all, false);
	assert.equal(parse_print_batch_args(['--print-import=bad', '--print-export=Wrenz']).all, false);
	// asked for explicitly, all still holds next to a bad flag
	assert.equal(parse_print_batch_args(['--print-export-all', '--print-import=bad']).all, true);
});

test('an outfit file exports only the outfit, not every saved character (#107)', () => {
	const batch = parse_print_batch_args(['--print-outfit=/Users/kara/outfits/standard.json', '--print-outfit= /Users/kara/outfits/standard.json ']);
	assert.deepEqual(batch, { all: false, names: [], imports: [], outfits: ['/Users/kara/outfits/standard.json'], errors: [] });
});

test('an empty outfit flag is reported and exports nothing else', () => {
	const batch = parse_print_batch_args(['--print-outfit=']);
	assert.equal(batch.all, false);
	assert.deepEqual(batch.outfits, []);
	assert.equal(batch.errors.length, 1);
});

test('realm names become armory slugs', () => {
	assert.equal(realm_slug('Argent Dawn'), 'argent-dawn');
	assert.equal(realm_slug("Kel'Thuzad"), 'kelthuzad');
	assert.equal(realm_slug('  Silvermoon '), 'silvermoon');
	assert.equal(realm_slug(null), '');
});

test('a character with a realm goes to character/<realm>/<name>', () => {
	assert.equal(character_folder('argent-dawn', 'Manatorque'), 'character/argent-dawn/Manatorque');
	assert.equal(character_folder('Argent Dawn', 'Manatorque'), 'character/argent-dawn/Manatorque');
});

test('a character with no realm goes to character/local/<name>', () => {
	assert.equal(character_folder(null, 'Lockspanner'), 'character/local/Lockspanner');
	assert.equal(character_folder('', 'Lockspanner'), 'character/local/Lockspanner');
});

test('folder names drop characters the file system refuses, and fall back to the save id', () => {
	assert.equal(character_folder(null, 'What?: "Mine"'), 'character/local/What Mine');
	assert.equal(character_folder(null, '???', '12345'), 'character/local/12345');
	assert.equal(character_folder(null, 'Zoë Brightspark'), 'character/local/Zoë Brightspark');
});

test('selecting saved characters: all, or by name in any case, with the missing ones listed', () => {
	const saved = [{ name: 'Lockspanner', id: '1' }, { name: 'Wrenz', id: '2' }, { name: 'wrenz', id: '3' }];
	assert.deepEqual(select_saved(saved, { all: true, names: [] }).selected.map(c => c.id), ['1', '2', '3']);

	const named = select_saved(saved, { all: false, names: ['WRENZ', 'Nobody'] });
	assert.deepEqual(named.selected.map(c => c.id), ['2', '3']);
	assert.deepEqual(named.missing, ['Nobody']);
});

test('Export for printing: an imported character goes to character/<realm>/<name> (F14)', () => {
	assert.equal(print_export_folder('Manatorque', 'wyrmrest-accord'), 'character/wyrmrest-accord/Manatorque');
});

test('Export for printing: a saved character never imported goes to character/local/<name>', () => {
	assert.equal(print_export_folder('Wrenz', null), 'character/local/Wrenz');
	assert.equal(print_export_folder(' Wrenz ', ''), 'character/local/Wrenz');
});

test('Export for printing: a character built by hand keeps the model folder', () => {
	assert.equal(print_export_folder(null, 'wyrmrest-accord'), null);
	assert.equal(print_export_folder('   ', null), null);
});
