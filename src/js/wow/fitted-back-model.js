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
	DBItemModels drops empty ModelResourcesID slots, so the hood's model came out
	first: the slot each model came from is kept beside it (model_resource_slots,
	display.modelSlots) for this test.
*/

/*
	Meshes of a fitted back model (wow-to-stl #319): some carry pieces for other
	body regions next to the cloak. Renowned Explorer's Rucksack (item 171333,
	model resource 54344) has geosets 501, 1101, 1801, 2201 and 2801 (shin, thigh,
	belt, torso and upper-arm pieces) beside the backpack (1501); two more fitted
	back models in the game data do the same (51130, 56130). The game shows only
	the cloak group, as for any back collection model (Wowhead's render: backpack
	only). Every mesh was kept, so those pieces were exported and printed too.
	The 3D capes (cape_armor_legion_d_01 and the like) have only 1501 and are
	unchanged.
*/

const HEAD_SLOT = 1;
const BACK_SLOT = 15;
const CLOAK_GEOSET_GROUP = 15;

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
 * The ModelResourcesID slot of each model resource an item display uses, in order: the
 * positions of the non-zero entries (ItemDisplayInfo.ModelResourcesID [0, 62770], the camo
 * hood, gives [1]).
 * @param {number[]} model_resources_ids - ItemDisplayInfo.ModelResourcesID
 * @returns {number[]}
 */
function model_resource_slots(model_resources_ids) {
	const slots = [];
	(model_resources_ids || []).forEach((id, slot) => {
		if (id > 0)
			slots.push(slot);
	});
	return slots;
}

/**
 * Whether a head item model is built on the character's skeleton (skinned like a
 * collection model) rather than pinned to the Helm attachment point: the models of
 * the display's second ModelResourcesID slot.
 * @param {number} slot_id - equipment slot (1 = head)
 * @param {number} model_slot - the ModelResourcesID slot the model came from (display.modelSlots)
 * @returns {boolean}
 */
function is_fitted_head_model(slot_id, model_slot) {
	return slot_id === HEAD_SLOT && model_slot >= 1;
}

/**
 * Which meshes of a race-fitted back model to show: only the cloak group's mesh that
 * the display picks (15xx, 1 + AttachmentGeosetGroup[0]); every other mesh is hidden.
 * @param {number[]} submesh_ids - the model's skin submesh ids, in draw order
 * @param {number[]} [attachment_geoset_group] - ItemDisplayInfo.AttachmentGeosetGroup
 * @returns {boolean[]}
 */
function fitted_back_geoset_visibility(submesh_ids, attachment_geoset_group) {
	const range_min = CLOAK_GEOSET_GROUP * 100;
	const target_id = range_min + 1 + (attachment_geoset_group?.[0] ?? 0);
	return (submesh_ids || []).map(id => id === target_id);
}

module.exports = {
	fitted_back_geoset_visibility,
	HEAD_SLOT,
	BACK_SLOT,
	is_fitted_back_model,
	is_fitted_head_model,
	model_resource_slots
};
