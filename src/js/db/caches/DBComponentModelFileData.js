/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
*/

const log = require('../../log');
const db2 = require('../../casc/db2');
const { as_chain, pick_model_variant } = require('../../wow/race-fallback');

// maps FileDataID -> { raceID, genderIndex, classID, positionIndex }
const file_data_to_info = new Map();

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
		is_initialized = true;
		init_promise = null;
	})();

	return init_promise;
};

/**
 * Filter a list of FileDataIDs to find the best match for race/gender.
 * Order: the race's own entry (exact gender, then either gender), the same for each
 * fallback race (ChrRaces.*ModelFallbackRaceID, see DBChrRaces), a race-0 entry, the first.
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @param {Array<{raceID: number, genderIndex: number}>|number} [fallback] - fallback chain
 * from DBChrRaces.getModelFallbackChain (a bare race id is accepted too)
 * @returns {number|null} - best matching FileDataID or null
 */
const getModelForRaceGender = (file_data_ids, race_id, gender_index, fallback = 0) => {
	if (!file_data_ids || file_data_ids.length === 0)
		return null;

	// if only one option, return it
	if (file_data_ids.length === 1)
		return file_data_ids[0];

	const candidates = file_data_ids.map(fdid => ({ fdid, info: file_data_to_info.get(fdid) }));
	return pick_model_variant(candidates, race_id, gender_index, as_chain(fallback, gender_index), GENDER_ANY);
};

/**
 * Get two models for left/right shoulders based on PositionIndex.
 * Filters by race/gender and returns models with PositionIndex 0 (left) and 1 (right).
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @param {Array<{raceID: number, genderIndex: number}>|number} [fallback] - fallback chain, as getModelForRaceGender
 * @returns {{left: number|null, right: number|null}}
 */
const getModelsForRaceGenderByPosition = (file_data_ids, race_id, gender_index, fallback = 0) => {
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

	// best match per side: own race, fallback races, any race, first
	const chain = as_chain(fallback, gender_index);
	const find_best = (candidates) => pick_model_variant(candidates, race_id, gender_index, chain, GENDER_ANY);

	result.left = find_best(by_position[0]);
	result.right = find_best(by_position[1]);

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
	hasEntry,
	getInfo
};
