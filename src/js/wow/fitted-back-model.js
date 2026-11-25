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

	Fitted head models (wow-to-stl #316, upstream issue 521): an item display
	keeps the model pinned to the Helm attachment in its first ModelResourcesID
	slot and a model built on the character's skeleton in its second.
	Vagabond's Camo Hood (item 206293, display 655731) has only the second: one
	model per race and sex, already at head height. Taken as the helm, it was
	pinned to the Helm point and floated a head-height above every race. A head
	model from the second slot is skinned like the fitted capes; the attached
	helm (Judgment Crown 16955, display 45888, first slot only) stays attached.
*/

const HEAD_SLOT = 1;
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

/**
 * Whether a head item model is built on the character's skeleton (skinned like a
 * collection model) rather than pinned to the Helm attachment point: the models of
 * the display's second ModelResourcesID slot.
 * @param {number} slot_id - equipment slot (1 = head)
 * @param {number} model_index - the ModelResourcesID slot the model came from (display.modelIndices)
 * @returns {boolean}
 */
function is_fitted_head_model(slot_id, model_index) {
	return slot_id === HEAD_SLOT && model_index >= 1;
}

module.exports = {
	HEAD_SLOT,
	BACK_SLOT,
	is_fitted_back_model,
	is_fitted_head_model
};
