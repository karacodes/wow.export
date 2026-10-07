/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Race fallback for items: which race's variant of an item model or texture a
	character gets when the item has none for their own race.

	Allied races (mechagnome, lightforged draenei, dark iron dwarf...) share the
	rig of a core race and most items have no variant tagged with the allied
	race id. The game resolves that with ChrRaces.MaleModelFallbackRaceID /
	FemaleModelFallbackRaceID (+Sex) for models and the Texture* twins for
	textures; without it a mechagnome picks whatever variant comes first, which
	is the human one, and a cape built for the human rig renders at human height.
*/

const MAX_CHAIN = 4;

/**
 * Walk the fallback links from a race/gender into an ordered list of
 * {raceID, genderIndex} to try after the race itself. Stops at the first
 * missing link, a repeat, or MAX_CHAIN entries.
 * @param {number} race_id
 * @param {number} gender_index - 0=male, 1=female
 * @param {(race_id: number, gender_index: number) => ({raceID: number, genderIndex: number}|null|undefined)} next
 * @returns {Array<{raceID: number, genderIndex: number}>}
 */
function build_fallback_chain(race_id, gender_index, next) {
	const chain = [];
	const seen = new Set([race_id + ':' + gender_index]);

	let race = race_id;
	let gender = gender_index;
	while (chain.length < MAX_CHAIN) {
		const link = next(race, gender);
		if (!link || !(link.raceID > 0))
			break;

		const key = link.raceID + ':' + link.genderIndex;
		if (seen.has(key))
			break;

		seen.add(key);
		chain.push({ raceID: link.raceID, genderIndex: link.genderIndex });
		race = link.raceID;
		gender = link.genderIndex;
	}

	return chain;
}

/**
 * Normalize the fallback argument of the ComponentModelFileData / ComponentTextureFileData
 * queries: a chain array as is, a bare race id (the old parameter) as a one-link chain
 * with the character's gender, anything else as no chain.
 * @param {Array|number|undefined} fallback
 * @param {number} gender_index
 * @returns {Array<{raceID: number, genderIndex: number}>}
 */
function as_chain(fallback, gender_index) {
	if (Array.isArray(fallback))
		return fallback;

	if (typeof fallback === 'number' && fallback > 0)
		return [{ raceID: fallback, genderIndex: gender_index }];

	return [];
}

/**
 * Rank of a candidate's race for a character: 0 for the character's own race,
 * 1 + n for the n-th fallback race, and a large value for any other race.
 * @param {number} candidate_race_id
 * @param {number} race_id
 * @param {Array<{raceID: number}>} chain
 * @returns {number}
 */
function race_rank(candidate_race_id, race_id, chain) {
	if (candidate_race_id === race_id)
		return 0;

	const index = chain.findIndex(link => link.raceID === candidate_race_id);
	return index >= 0 ? 1 + index : MAX_CHAIN + 2;
}

/**
 * Pick the model variant for a race/gender: the race's own gender-matching entry,
 * then its generic-gender one, then the same for each fallback race in order,
 * then a race-0 (any race) entry, then the first candidate.
 * @param {Array<{fdid: number, info: ({raceID: number, genderIndex: number}|undefined)}>} candidates
 * @param {number} race_id
 * @param {number} gender_index
 * @param {Array<{raceID: number, genderIndex: number}>} chain
 * @param {number} gender_any - the GenderIndex value that means "either gender"
 * @returns {number|null}
 */
function pick_model_variant(candidates, race_id, gender_index, chain, gender_any) {
	if (!candidates || candidates.length === 0)
		return null;

	const find = (race, gender) => {
		const exact = candidates.find(c => c.info && c.info.raceID === race && c.info.genderIndex === gender);
		if (exact)
			return exact.fdid;

		const any_gender = candidates.find(c => c.info && c.info.raceID === race && c.info.genderIndex === gender_any);
		return any_gender ? any_gender.fdid : null;
	};

	const own = find(race_id, gender_index);
	if (own !== null)
		return own;

	for (const link of chain) {
		const found = find(link.raceID, link.genderIndex);
		if (found !== null)
			return found;
	}

	const any_race = candidates.find(c => c.info && c.info.raceID === 0);
	if (any_race)
		return any_race.fdid;

	return candidates[0].fdid;
}

module.exports = {
	MAX_CHAIN,
	build_fallback_chain,
	as_chain,
	race_rank,
	pick_model_variant
};
