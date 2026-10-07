/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	ChrRaces fallback links: which race (and sex) an item model or texture comes
	from when none is tagged for the character's own race. See src/js/wow/race-fallback.js.
*/

const log = require('../../log');
const db2 = require('../../casc/db2');
const { build_fallback_chain } = require('../../wow/race-fallback');

// raceID -> { model: [male link, female link], texture: [male link, female link] }
const race_fallbacks = new Map();

let is_initialized = false;
let init_promise = null;

const link = (race_id, sex) => (race_id > 0 ? { raceID: race_id, genderIndex: sex === 1 ? 1 : 0 } : null);

const initialize = async () => {
	if (is_initialized)
		return;

	if (init_promise)
		return init_promise;

	init_promise = (async () => {
		log.write('Loading ChrRaces fallback links...');

		for (const [race_id, row] of await db2.ChrRaces.getAllRows()) {
			race_fallbacks.set(race_id, {
				model: [
					link(row.MaleModelFallbackRaceID ?? 0, row.MaleModelFallbackSex ?? 0),
					link(row.FemaleModelFallbackRaceID ?? 0, row.FemaleModelFallbackSex ?? 1)
				],
				texture: [
					link(row.MaleTextureFallbackRaceID ?? 0, row.MaleTextureFallbackSex ?? 0),
					link(row.FemaleTextureFallbackRaceID ?? 0, row.FemaleTextureFallbackSex ?? 1)
				]
			});
		}

		log.write('Loaded fallback links for %d races', race_fallbacks.size);
		is_initialized = true;
		init_promise = null;
	})();

	return init_promise;
};

const ensure_initialized = async () => {
	if (!is_initialized)
		await initialize();
};

const next_link = (kind) => (race_id, gender_index) => race_fallbacks.get(race_id)?.[kind]?.[gender_index === 1 ? 1 : 0] ?? null;

/**
 * Races to try, in order, for an item MODEL the character's race has no variant of.
 * @param {number} race_id
 * @param {number} gender_index - 0=male, 1=female
 * @returns {Array<{raceID: number, genderIndex: number}>}
 */
const get_model_fallback_chain = (race_id, gender_index) => {
	if (race_id === undefined || race_id === null)
		return [];

	return build_fallback_chain(race_id, gender_index, next_link('model'));
};

/**
 * Races to try, in order, for an item TEXTURE the character's race has no variant of.
 * @param {number} race_id
 * @param {number} gender_index - 0=male, 1=female
 * @returns {Array<{raceID: number, genderIndex: number}>}
 */
const get_texture_fallback_chain = (race_id, gender_index) => {
	if (race_id === undefined || race_id === null)
		return [];

	return build_fallback_chain(race_id, gender_index, next_link('texture'));
};

module.exports = {
	initialize,
	ensureInitialized: ensure_initialized,
	getModelFallbackChain: get_model_fallback_chain,
	getTextureFallbackChain: get_texture_fallback_chain
};
