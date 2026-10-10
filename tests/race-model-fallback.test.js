/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #154: the highmountain tauren male's cape (Back item
	253340) hung from his waist. The cape ships one race-fitted model per race and sex and
	none for Highmountain Tauren, so the model picker fell through to the first candidate,
	another race's cape, sized for that body. The game uses the race's model fallback from
	ChrRaces (Highmountain Tauren -> Tauren, with the fallback's sex). The game tables are
	small fakes fed to the real DBComponentModelFileData cache.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const src = (...parts) => path.join(__dirname, '..', 'src', 'js', ...parts);

const HUMAN = 1, NIGHT_ELF = 4, TAUREN = 6, NIGHTBORNE = 27, HIGHMOUNTAIN = 28, HARRONIR = 86, HARRONIR_2 = 91;
const THIN_HUMAN = 33, BLOOD_ELF = 10;
const MALE = 0, FEMALE = 1, ANY = 2;

// a race-fitted cape: one model per race and sex, listed human first (as ModelFileData lists them)
const CAPE = { hu_m: 101, hu_f: 102, ta_m: 103, ta_f: 104, ni_m: 105, be_f: 106 };
const TABLES = {
	ComponentModelFileData: [
		[CAPE.hu_m, { RaceID: HUMAN, GenderIndex: MALE, ClassID: 0, PositionIndex: -1 }],
		[CAPE.hu_f, { RaceID: HUMAN, GenderIndex: FEMALE, ClassID: 0, PositionIndex: -1 }],
		[CAPE.ta_m, { RaceID: TAUREN, GenderIndex: MALE, ClassID: 0, PositionIndex: -1 }],
		[CAPE.ta_f, { RaceID: TAUREN, GenderIndex: FEMALE, ClassID: 0, PositionIndex: -1 }],
		[CAPE.ni_m, { RaceID: NIGHT_ELF, GenderIndex: MALE, ClassID: 0, PositionIndex: -1 }],
		[CAPE.be_f, { RaceID: BLOOD_ELF, GenderIndex: FEMALE, ClassID: 0, PositionIndex: -1 }],
		// a shoulder pair with left/right models for humans and tauren
		[201, { RaceID: HUMAN, GenderIndex: ANY, ClassID: 0, PositionIndex: 0 }],
		[202, { RaceID: HUMAN, GenderIndex: ANY, ClassID: 0, PositionIndex: 1 }],
		[203, { RaceID: TAUREN, GenderIndex: ANY, ClassID: 0, PositionIndex: 0 }],
		[204, { RaceID: TAUREN, GenderIndex: ANY, ClassID: 0, PositionIndex: 1 }]
	],
	// the model fallback columns as build 12.1.0.69933 has them for these races
	ChrRaces: [
		[HUMAN, { MaleModelFallbackRaceID: 0, MaleModelFallbackSex: -1, FemaleModelFallbackRaceID: 0, FemaleModelFallbackSex: -1 }],
		[TAUREN, { MaleModelFallbackRaceID: 0, MaleModelFallbackSex: -1, FemaleModelFallbackRaceID: 0, FemaleModelFallbackSex: -1 }],
		[HIGHMOUNTAIN, { MaleModelFallbackRaceID: TAUREN, MaleModelFallbackSex: 0, FemaleModelFallbackRaceID: TAUREN, FemaleModelFallbackSex: 1 }],
		[NIGHTBORNE, { MaleModelFallbackRaceID: NIGHT_ELF, MaleModelFallbackSex: 0, FemaleModelFallbackRaceID: NIGHT_ELF, FemaleModelFallbackSex: 1 }],
		[HARRONIR, { MaleModelFallbackRaceID: NIGHTBORNE, MaleModelFallbackSex: 0, FemaleModelFallbackRaceID: NIGHTBORNE, FemaleModelFallbackSex: 1 }],
		[HARRONIR_2, { MaleModelFallbackRaceID: HARRONIR, MaleModelFallbackSex: 0, FemaleModelFallbackRaceID: HARRONIR, FemaleModelFallbackSex: 1 }],
		[THIN_HUMAN, { MaleModelFallbackRaceID: BLOOD_ELF, MaleModelFallbackSex: 1, FemaleModelFallbackRaceID: 0, FemaleModelFallbackSex: -1 }]
	]
};

const stub = (file, exports) => {
	const id = require.resolve(file);
	require.cache[id] = { id, filename: id, loaded: true, exports };
};

stub(src('log.js'), { write: () => {} });
stub(src('casc', 'db2.js'), new Proxy({}, {
	get: (target, table) => ({ getAllRows: async () => new Map(TABLES[table] || []) })
}));

const DBComponentModelFileData = require(src('db', 'caches', 'DBComponentModelFileData.js'));
const cape_options = Object.values(CAPE);

test('a highmountain tauren wears the tauren cape of his sex, not the first race\'s', async () => {
	await DBComponentModelFileData.initialize();
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, HIGHMOUNTAIN, MALE), CAPE.ta_m);
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, HIGHMOUNTAIN, FEMALE), CAPE.ta_f);
});

test('a race with its own model keeps it', async () => {
	await DBComponentModelFileData.initialize();
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, TAUREN, MALE), CAPE.ta_m);
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, HUMAN, FEMALE), CAPE.hu_f);
});

test('the fallback follows a chain and takes the fallback\'s sex', async () => {
	await DBComponentModelFileData.initialize();
	// Harronir (91) -> Harronir (86) -> Nightborne -> Night Elf
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, HARRONIR_2, MALE), CAPE.ni_m);
	// a ThinHuman male falls back to the blood elf female body
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, THIN_HUMAN, MALE), CAPE.be_f);
	assert.deepEqual(DBComponentModelFileData.getRaceChain(HIGHMOUNTAIN, FEMALE),
		[{ raceID: HIGHMOUNTAIN, genderIndex: FEMALE }, { raceID: TAUREN, genderIndex: FEMALE }]);
});

test('shoulders use the fallback race too', async () => {
	await DBComponentModelFileData.initialize();
	assert.deepEqual(DBComponentModelFileData.getModelsForRaceGenderByPosition([201, 202, 203, 204], HIGHMOUNTAIN, MALE), { left: 203, right: 204 });
});

test('a race with no model and no fallback still gets the first candidate', async () => {
	await DBComponentModelFileData.initialize();
	assert.equal(DBComponentModelFileData.getModelForRaceGender(cape_options, 999, MALE), CAPE.hu_m);
});
