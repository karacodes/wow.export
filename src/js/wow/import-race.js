/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The race a Battle.net import loads. Some armory races have no character model of their
	own here (faction pandaren, horde dracthyr), and "Load visage model" swaps a worgen or a
	dracthyr for its other form.

	A worgen's human form is ChrRaces 23 (Gilnean), not 1 (human): Worgen's
	UnalteredVisualCustomizationRaceID is 23. Race 23's models (ChrModel 45/46) use the human
	body (same DisplayID and skeleton as ChrModel 1/2), but their customization options have
	their own ids (213-221, 382), and the armory's human-form choices use those ids. Race 1
	would load the same body and drop every one of them, so the import would come out as a
	default human. That is what upstream PR #599 (23 -> 1) would do (wow-to-stl #231).
*/

const RACE = {
	WORGEN: 22,
	GILNEAN: 23, // the worgen's human form
	PANDAREN_NEUTRAL: 24,
	PANDAREN_ALLIANCE: 25,
	PANDAREN_HORDE: 26,
	DRACTHYR_ALLIANCE: 52,
	DRACTHYR_HORDE: 70,
	DRACTHYR_VISAGE: 75
};

/**
 * The race whose model and customization options a Battle.net import uses.
 * @param {number} race_id - the armory's playable_race.id
 * @param {boolean} load_visage - "Load visage model" is ticked
 * @returns {number}
 */
function import_race_id(race_id, load_visage) {
	// pandaren with faction -> use neutral
	if (race_id === RACE.PANDAREN_ALLIANCE || race_id === RACE.PANDAREN_HORDE)
		return RACE.PANDAREN_NEUTRAL;

	// dracthyr horde -> use alliance
	if (race_id === RACE.DRACTHYR_HORDE)
		race_id = RACE.DRACTHYR_ALLIANCE;

	if (load_visage) {
		if (race_id === RACE.WORGEN)
			return RACE.GILNEAN;

		if (race_id === RACE.DRACTHYR_ALLIANCE)
			return RACE.DRACTHYR_VISAGE;
	}

	return race_id;
}

module.exports = { RACE, import_race_id };
