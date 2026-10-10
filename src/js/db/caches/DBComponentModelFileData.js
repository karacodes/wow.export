/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
*/

const log = require('../../log');
const db2 = require('../../casc/db2');

// maps FileDataID -> { raceID, genderIndex, classID, positionIndex }
const file_data_to_info = new Map();

// maps ChrRaces ID -> [male, female] model fallback { raceID, genderIndex } (or null): the
// race whose item models the game uses when an item has none for this race, e.g.
// Highmountain Tauren -> Tauren (MaleModelFallbackRaceID / MaleModelFallbackSex)
const race_model_fallback = new Map();

let is_initialized = false;
let init_promise = null;

const GENDER_ANY = 2;

const initialize = async () => {
	if (is_initialized)
		return;

	if (init_promise)
		return init_promise;

	init_promise = (async () => {
		log.write('Loading ComponentModelFileData...');

		for (const [id, row] of await db2.ComponentModelFileData.getAllRows()) {
			file_data_to_info.set(id, {
				raceID: row.RaceID,
				genderIndex: row.GenderIndex,
				classID: row.ClassID,
				positionIndex: row.PositionIndex
			});
		}

		log.write('Loaded ComponentModelFileData for %d models', file_data_to_info.size);

		for (const [id, row] of await db2.ChrRaces.getAllRows()) {
			const fallback = (race_id, sex) => race_id > 0 ? { raceID: race_id, genderIndex: sex >= 0 ? sex : null } : null;
			race_model_fallback.set(id, [
				fallback(row.MaleModelFallbackRaceID, row.MaleModelFallbackSex),
				fallback(row.FemaleModelFallbackRaceID, row.FemaleModelFallbackSex)
			]);
		}
		is_initialized = true;
		init_promise = null;
	})();

	return init_promise;
};

/**
 * The races to look for an item model under, best first: the character's own race and
 * sex, then the race's model fallback chain from ChrRaces (Highmountain Tauren male ->
 * Tauren male; Harronir -> Nightborne -> Night Elf). The game picks models this way;
 * without the fallback a race-fitted cape with no model for the race fell through to
 * another race's model, sized for that body (wow-to-stl #154).
 * @param {number} race_id
 * @param {number} gender_index - 0=male, 1=female
 * @returns {Array<{raceID: number, genderIndex: number}>}
 */
const getRaceChain = (race_id, gender_index) => {
	const chain = [{ raceID: race_id, genderIndex: gender_index }];
	const seen = new Set([race_id + '-' + gender_index]);

	let current = chain[0];
	while (true) {
		const fallback = race_model_fallback.get(current.raceID)?.[current.genderIndex === 1 ? 1 : 0];
		if (!fallback)
			break;

		const next = { raceID: fallback.raceID, genderIndex: fallback.genderIndex ?? current.genderIndex };
		const key = next.raceID + '-' + next.genderIndex;
		if (seen.has(key))
			break;

		seen.add(key);
		chain.push(next);
		current = next;
	}

	return chain;
};

/**
 * The best candidate for a race chain: for each race in turn the exact sex, then any
 * sex; then a race-neutral (race 0) entry; then the first candidate.
 * @param {Array<{fdid: number, info: object|undefined}>} candidates
 * @param {number} race_id
 * @param {number} gender_index
 * @returns {number|null}
 */
const pick_best = (candidates, race_id, gender_index) => {
	for (const want of getRaceChain(race_id, gender_index)) {
		for (const c of candidates) {
			if (c.info && c.info.raceID === want.raceID && c.info.genderIndex === want.genderIndex)
				return c.fdid;
		}

		for (const c of candidates) {
			if (c.info && c.info.raceID === want.raceID && c.info.genderIndex === GENDER_ANY)
				return c.fdid;
		}
	}

	for (const c of candidates) {
		if (c.info && c.info.raceID === 0)
			return c.fdid;
	}

	return candidates.length > 0 ? candidates[0].fdid : null;
};

/**
 * Filter a list of FileDataIDs to find the best match for race/gender
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @returns {number|null} - best matching FileDataID or null
 */
const getModelForRaceGender = (file_data_ids, race_id, gender_index) => {
	if (!file_data_ids || file_data_ids.length === 0)
		return null;

	// if only one option, return it
	if (file_data_ids.length === 1)
		return file_data_ids[0];

	return pick_best(file_data_ids.map(fdid => ({ fdid, info: file_data_to_info.get(fdid) })), race_id, gender_index);
};

/**
 * Get two models for left/right shoulders based on PositionIndex.
 * Filters by race/gender and returns models with PositionIndex 0 (left) and 1 (right).
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @returns {{left: number|null, right: number|null}}
 */
const getModelsForRaceGenderByPosition = (file_data_ids, race_id, gender_index) => {
	const result = { left: null, right: null };

	if (!file_data_ids || file_data_ids.length === 0)
		return result;

	// group candidates by positionIndex, filtering by race/gender
	const by_position = { 0: [], 1: [] };

	for (const fdid of file_data_ids) {
		const info = file_data_to_info.get(fdid);
		if (!info || (info.positionIndex !== 0 && info.positionIndex !== 1))
			continue;

		by_position[info.positionIndex].push({ fdid, info });
	}

	result.left = pick_best(by_position[0], race_id, gender_index);
	result.right = pick_best(by_position[1], race_id, gender_index);

	return result;
};

/**
 * Check if a FileDataID has ComponentModelFileData entry
 * @param {number} file_data_id
 * @returns {boolean}
 */
const hasEntry = (file_data_id) => {
	return file_data_to_info.has(file_data_id);
};

/**
 * Get info for a FileDataID
 * @param {number} file_data_id
 * @returns {object|null}
 */
const getInfo = (file_data_id) => {
	return file_data_to_info.get(file_data_id) || null;
};

module.exports = {
	initialize,
	getModelForRaceGender,
	getModelsForRaceGenderByPosition,
	getRaceChain,
	hasEntry,
	getInfo
};
