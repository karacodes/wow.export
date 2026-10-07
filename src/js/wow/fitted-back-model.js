/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Race-fitted back models: newer 3D capes ship one model per race and sex
	(cape_armor_legion_d_01_mg_f.m2 for a mechagnome female, _gn_m for a gnome
	male...) built on the character's own skeleton, like the collections_*
	chest and leg models. They must be skinned to the character's bones. Pinned
	to the Back attachment point (12) instead, their character-space geometry
	is lifted by the attachment's height: the mechagnome's flame cape hung a
	body-height above her (Kara, 2026-10-07).

	A back model with a ComponentModelFileData row for a specific race is such a
	fitted model; race-neutral back models (backpacks, quivers, old capes) have
	no row or race 0 and stay attachments.
*/

const BACK_SLOT = 15;

/**
 * Whether an item model in a slot is a race-fitted model to skin to the character's
 * bones rather than pin to the slot's attachment point.
 * @param {number} slot_id - equipment slot (15 = back)
 * @param {{raceID: number}|null|undefined} model_info - the model's ComponentModelFileData row
 * @returns {boolean}
 */
function is_fitted_back_model(slot_id, model_info) {
	if (slot_id !== BACK_SLOT)
		return false;

	return !!model_info && model_info.raceID > 0;
}

module.exports = {
	BACK_SLOT,
	is_fitted_back_model
};
