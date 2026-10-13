/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #122: a customization choice with several
	ChrCustomizationElement geoset rows turns every one of them on (the cache kept only the last
	row), a row tied to another choice (RelatedChrCustomizationChoiceID) only while that choice is
	picked, and the sidecar names every geoset of the choice. Also wow-to-stl #226: a picked
	choice's geoset hides the rest of its group, the ..01 default too, when the plain variant has
	no element row. The game tables are small fakes fed to the real DBCharacterCustomization cache. Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const src = (...parts) => path.join(__dirname, '..', 'src', 'js', ...parts);

// one model (ChrModel 1) with two options:
//   option 10 "Hair Style": choice 100 "Braids" names hair 5 and braid 1702 (two rows);
//                           choice 101 "Short" names hair 6 only
//   option 20 "Ears":       choice 200 "Long" names ears 702, and ear rings 2402 only while
//                           Braids (100) is picked; choice 201 "Short" names 703
//   option 30 "Jaw Features": choice 300 "Closed" has no element row (the model's jaw 101);
//                           choice 301 "Cheeky Slackjaw" names jaw 102 (an Undead's)
const TABLES = {
	TextureFileData: [],
	ChrCustomizationCondModel: [],
	ChrCustomizationReq: [],
	ChrCustomizationMaterial: [],
	ChrCustomizationSkinnedModel: [],
	ChrRaces: [],
	ChrRaceXChrModel: [],
	ChrModelMaterial: [],
	CharComponentTextureSections: [],
	ChrModelTextureLayer: [],
	ChrModel: [[1, { DisplayID: 1, CharComponentTextureLayoutID: 1 }]],
	ChrCustomizationOption: [
		[10, { ChrModelID: 1, Name_lang: 'Hair Style', OrderIndex: 0, Flags: 0, Requirement: 0 }],
		[20, { ChrModelID: 1, Name_lang: 'Ears', OrderIndex: 1, Flags: 0, Requirement: 0 }],
		[30, { ChrModelID: 1, Name_lang: 'Jaw Features', OrderIndex: 2, Flags: 0, Requirement: 0 }]
	],
	ChrCustomizationChoice: [
		[100, { ChrCustomizationOptionID: 10, Name_lang: 'Braids', OrderIndex: 0, ChrCustomizationReqID: 0 }],
		[101, { ChrCustomizationOptionID: 10, Name_lang: 'Short', OrderIndex: 1, ChrCustomizationReqID: 0 }],
		[200, { ChrCustomizationOptionID: 20, Name_lang: 'Long', OrderIndex: 0, ChrCustomizationReqID: 0 }],
		[201, { ChrCustomizationOptionID: 20, Name_lang: 'Short', OrderIndex: 1, ChrCustomizationReqID: 0 }],
		[300, { ChrCustomizationOptionID: 30, Name_lang: 'Closed', OrderIndex: 0, ChrCustomizationReqID: 0 }],
		[301, { ChrCustomizationOptionID: 30, Name_lang: 'Cheeky Slackjaw', OrderIndex: 1, ChrCustomizationReqID: 0 }]
	],
	// ChrCustomizationGeoset id -> GeosetType / GeosetID
	ChrCustomizationGeoset: [
		[1, { GeosetType: 0, GeosetID: 5 }],
		[2, { GeosetType: 17, GeosetID: 2 }],
		[3, { GeosetType: 0, GeosetID: 6 }],
		[4, { GeosetType: 7, GeosetID: 2 }],
		[5, { GeosetType: 24, GeosetID: 2 }],
		[6, { GeosetType: 7, GeosetID: 3 }],
		[7, { GeosetType: 1, GeosetID: 2 }]
	],
	ChrCustomizationElement: [
		[1, { ChrCustomizationChoiceID: 100, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 1 }],
		[2, { ChrCustomizationChoiceID: 100, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 2 }],
		[3, { ChrCustomizationChoiceID: 101, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 3 }],
		[4, { ChrCustomizationChoiceID: 200, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 4 }],
		[5, { ChrCustomizationChoiceID: 200, RelatedChrCustomizationChoiceID: 100, ChrCustomizationGeosetID: 5 }],
		[6, { ChrCustomizationChoiceID: 201, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 6 }],
		[7, { ChrCustomizationChoiceID: 301, RelatedChrCustomizationChoiceID: 0, ChrCustomizationGeosetID: 7 }]
	]
};

const ELEMENT_DEFAULTS = { ChrCustomizationSkinnedModelID: 0, ChrCustomizationBoneSetID: 0, ChrCustomizationCondModelID: 0, ChrCustomizationDisplayInfoID: 0, ChrCustomizationMaterialID: 0 };

// the game-data modules the cache and the appearance code load, replaced before they are required
const stub = (file, exports) => {
	const id = require.resolve(file);
	require.cache[id] = { id, filename: id, loaded: true, exports };
};

stub(src('log.js'), { write: () => {} });
stub(src('casc', 'db2.js'), new Proxy({}, {
	get: (target, table) => ({
		getAllRows: async () => new Map((TABLES[table] || []).map(([id, row]) => [id, table === 'ChrCustomizationElement' ? { ...ELEMENT_DEFAULTS, ...row } : row])),
		getRow: async () => null
	})
}));
stub(src('db', 'caches', 'DBCreatures.js'), { initializeCreatureData: async () => {}, getFileDataIDByDisplayID: () => 1, getFileDataIDByModelDataID: () => undefined });
stub(src('3D', 'renderers', 'CharMaterialRenderer.js'), class {});

const DBCharacterCustomization = require(src('db', 'caches', 'DBCharacterCustomization.js'));
const character_appearance = require(src('ui', 'character-appearance.js'));

// the Custom Geoset Control rows of the model
const make_rows = () => [0, 1, 5, 6, 100, 101, 102, 701, 702, 703, 1701, 1702, 2401, 2402].map(id => ({ id, checked: false }));
const checked = rows => rows.filter(row => row.checked).map(row => row.id);

test('every geoset row of the picked choice is turned on', async () => {
	await DBCharacterCustomization.ensureInitialized();
	const rows = make_rows();
	character_appearance.apply_customization_geosets(rows, [{ optionID: 10, choiceID: 100 }]);

	// Braids: hair 5 and the braid 1702 both on (before #122 only the braid, the last row)
	assert.ok(checked(rows).includes(5), 'hair 5 of the Braids choice is on');
	assert.ok(checked(rows).includes(1702), 'braid 1702 of the Braids choice is on');
	assert.ok(!checked(rows).includes(6), 'the Short hair is off');
});

test('picking the other choice turns the first choice\'s geosets off', async () => {
	await DBCharacterCustomization.ensureInitialized();
	const rows = make_rows();
	for (const row of rows)
		row.checked = row.id === 5 || row.id === 1702;

	character_appearance.apply_customization_geosets(rows, [{ optionID: 10, choiceID: 101 }]);
	assert.ok(checked(rows).includes(6));
	assert.ok(!checked(rows).includes(5));
	assert.ok(!checked(rows).includes(1702));
});

test('a row tied to another choice only counts while that choice is picked', async () => {
	await DBCharacterCustomization.ensureInitialized();

	const with_braids = make_rows();
	character_appearance.apply_customization_geosets(with_braids, [{ optionID: 10, choiceID: 100 }, { optionID: 20, choiceID: 200 }]);
	assert.ok(checked(with_braids).includes(702));
	assert.ok(checked(with_braids).includes(2402), 'ear rings come with Long ears while Braids is picked');

	const with_short_hair = make_rows();
	character_appearance.apply_customization_geosets(with_short_hair, [{ optionID: 10, choiceID: 101 }, { optionID: 20, choiceID: 200 }]);
	assert.ok(checked(with_short_hair).includes(702));
	assert.ok(!checked(with_short_hair).includes(2402), 'no ear rings without Braids');
	assert.ok(!checked(with_short_hair).includes(703));
});

test('a choice lists every geoset it names, for the sidecar labels', async () => {
	await DBCharacterCustomization.ensureInitialized();
	assert.deepEqual(DBCharacterCustomization.get_choice_geoset_ids(100), [5, 1702]);
	assert.deepEqual(DBCharacterCustomization.get_choice_geoset_ids(200), [702, 2402]);
	assert.deepEqual(DBCharacterCustomization.get_choice_geoset_ids(999), []);
});

test('a picked choice hides its group\'s default when the plain variant has no row (#226)', async () => {
	await DBCharacterCustomization.ensureInitialized();

	// Cheeky Slackjaw: jaw 102 on and the default closed jaw 101 off (before #226 both showed)
	const slackjaw = make_rows();
	character_appearance.apply_customization_geosets(slackjaw, [{ optionID: 30, choiceID: 301 }]);
	assert.ok(checked(slackjaw).includes(102), 'the Slackjaw 102 is on');
	assert.ok(!checked(slackjaw).includes(101), 'the default jaw 101 is off under it');
	assert.ok(!checked(slackjaw).includes(100), 'the group\'s 00 row is left alone');
	assert.ok(checked(slackjaw).includes(2401), 'other groups keep their default');

	// Closed: the choice has no row, so the default 101 stays and 102 goes off
	const closed = make_rows();
	for (const row of closed)
		row.checked = row.id === 102;

	character_appearance.apply_customization_geosets(closed, [{ optionID: 30, choiceID: 300 }]);
	assert.ok(checked(closed).includes(101), 'the default jaw 101 is on');
	assert.ok(!checked(closed).includes(102), 'the Slackjaw 102 is off');
});

test('a conditional geoset hides its group\'s default only while it is on (#226)', async () => {
	await DBCharacterCustomization.ensureInitialized();

	const with_braids = make_rows();
	character_appearance.apply_customization_geosets(with_braids, [{ optionID: 10, choiceID: 100 }, { optionID: 20, choiceID: 200 }]);
	assert.ok(checked(with_braids).includes(2402));
	assert.ok(!checked(with_braids).includes(2401), 'ear rings 2402 replace the default 2401');

	const with_short_hair = make_rows();
	character_appearance.apply_customization_geosets(with_short_hair, [{ optionID: 10, choiceID: 101 }, { optionID: 20, choiceID: 200 }]);
	assert.ok(checked(with_short_hair).includes(2401), 'no ear rings, so the default 2401 stays');
});
