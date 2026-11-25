/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The replaceable textures an item display gives one of its models, as the list
	the renderer and the exporters read: entry n is M2 texture type n + 2 (2 object
	skin, 3 weapon blade, 4 weapon handle).

	ItemDisplayInfoModelMatRes.TextureType is that M2 texture type, not a position
	(wago.tools labels 3 "Weapon Blade"). The list used to be packed in TextureType
	order, so a display without a type-2 texture shifted every texture down a slot.
	Renowned Explorer's Rucksack (item 171333, display 677171, wow-to-stl #319,
	upstream issue 520) has only a type-3 texture (3055491): it landed on the
	model's type-2 slot, the backpack mesh (type 3) got nothing. About 1,600 item
	models in the game data skip a type the same way (most often 2 + 4, no 3).
*/

const FIRST_TYPE = 2;
const LAST_TYPE = 4;

/**
 * The variant texture list for one model: index n holds the first texture of M2
 * texture type n + 2, 0 where the display has none. Trailing empty slots are left off,
 * and a display with no texture of types 2-4 gives [].
 * @param {Array<{textureType: number, textureFileDataIDs: number[]}>} entries - the
 *   model's ItemDisplayInfoModelMatRes rows, in table order
 * @returns {number[]}
 */
function variant_textures_by_type(entries) {
	const list = [];
	for (const { textureType, textureFileDataIDs } of entries || []) {
		if (!(textureType >= FIRST_TYPE && textureType <= LAST_TYPE))
			continue;

		const file_data_id = textureFileDataIDs?.find(id => id > 0);
		if (!file_data_id)
			continue;

		const index = textureType - FIRST_TYPE;
		while (list.length <= index)
			list.push(0);

		// a type listed twice keeps its first texture
		if (list[index] === 0)
			list[index] = file_data_id;
	}

	return list;
}

/**
 * The same list from a display's textures grouped by type ({2: [...], 3: [...]}).
 * @param {Object<number, number[]>|undefined} textures_by_type
 * @returns {number[]}
 */
function variant_textures_from_type_map(textures_by_type) {
	if (!textures_by_type)
		return [];

	return variant_textures_by_type(Object.entries(textures_by_type).map(([type, ids]) => ({ textureType: Number(type), textureFileDataIDs: ids })));
}

module.exports = {
	variant_textures_by_type,
	variant_textures_from_type_map
};
