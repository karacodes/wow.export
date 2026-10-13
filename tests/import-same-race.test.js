/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #229: importing a character (Battle.net, WMV or Wowhead) of
	the race and body type already on screen kept the old character's look and gear. The import
	called update_model_selection itself while the race watcher was still to run: that call used
	up the import's choices without a redraw (the model file was already loaded), then the
	watchers ran update_model_selection again with the default choices and every redraw was
	skipped because the import was still in progress. Also every Wowhead import dropped all its
	customizations: ChrCustomizationChoice.getRow() was not awaited.
	The characters tab cannot load outside nw.js, so this checks the source.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modules', 'tab_characters.js'), 'utf8');

// the body of a top-level function: from its declaration to the first closing brace in column 0
function function_body(name) {
	const start = source.indexOf('\nasync function ' + name + '(');
	assert.notEqual(start, -1, name + ' not found');
	const end = source.indexOf('\n}\n', start);
	return source.slice(start, end);
}

test('an import leaves loading the model to the race and model watchers', () => {
	const body = function_body('apply_import_data');
	assert.match(body, /chrCustRaceSelection = \[/, 'the import no longer selects the race');
	assert.doesNotMatch(body, /update_model_selection\(/, 'the import selects the model itself: a same-race import keeps the old look');
});

test('a saved character loads the same way', () => {
	const body = function_body('load_character');
	assert.match(body, /chrCustRaceSelection = \[/);
	assert.doesNotMatch(body, /update_model_selection\(/);
});

test('every db2 row lookup in the characters tab is awaited', () => {
	const lookups = [...source.matchAll(/db2\.\w+\.getRow\(/g)];
	assert.ok(lookups.length > 0);
	for (const match of lookups) {
		const before = source.slice(source.lastIndexOf('\n', match.index), match.index);
		assert.match(before, /await\s+$/, 'not awaited: ' + before.trim() + match[0]);
	}
});
