/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	One equipped item model's row in the OBJ sidecar's `character.equipment` list. The row
	carries the game's item name (`name`, "Seven Sacred Seals", from ItemSparse via DBItems)
	so WoW Print can show it instead of the item number (wow-to-stl #301). The lookups are
	passed in, so the row can be tested without the game's tables.
 */

// DBItems' stand-in for an ItemSparse row without a name: not a name to show
const PLACEHOLDER_NAME = /^Unknown item #\d+$/;

/**
 * The game's name for an item, or null when the item is not in ItemSparse or has no name.
 * @param {object|null} item - a DBItems.getItemById record
 * @returns {string|null}
 */
const item_name = (item) => {
	const name = typeof item?.name === 'string' ? item.name.trim() : '';
	if (!name || PLACEHOLDER_NAME.test(name))
		return null;

	return name;
};

/**
 * The sidecar row for one equipment model (not a skinned customization model).
 * @param {object} equip - an entry of the equipment list given to M2Exporter.setEquipmentModels
 * @param {number} index - its position in that list (M2Exporter swaps it for the OBJ group names)
 * @param {object} lookups
 * @param {function(number): string|null} lookups.slot_name - EquipmentSlots.get_slot_name
 * @param {function(number, number): number|null} lookups.display_id - DBItemModels.getDisplayId
 * @param {function(number): object|null} lookups.item - DBItems.getItemById
 * @returns {object}
 */
const equipment_row = (equip, index, lookups) => {
	return {
		equipmentIndex: index,
		slot: equip.slot_id,
		slotName: lookups.slot_name(equip.slot_id) || null,
		itemID: equip.item_id,
		name: item_name(lookups.item(equip.item_id)),
		displayID: lookups.display_id(equip.item_id, equip.modifier_id) ?? null,
		modifierID: equip.modifier_id ?? 0,
		modelFileDataID: equip.renderer?.item_file_data_id ?? null,
		modelIndex: equip.model_index ?? 0,
		attachmentID: equip.is_collection_style ? null : (equip.attachment_id ?? null),
		style: equip.is_collection_style ? 'collection' : 'attachment',
		textures: equip.textures || []
	};
};

module.exports = { item_name, equipment_row };
