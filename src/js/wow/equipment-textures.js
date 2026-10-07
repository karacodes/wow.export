/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Textures an equipment model's export has to write. The item display's textures
	(replaceable types 2-4 and 11-13) were the only ones written, so a model whose
	textures are baked into the M2 itself (type 0, e.g. the blood elf's warglaives,
	knife_1h_deathwingraid_e_03.m2, whose display lists no textures) exported every
	mesh with no material (Kara's blood elf export, 2026-10-07). The viewer draws them
	because the renderer loads type-0 textures from the model.
*/

/**
 * The display's texture list followed by the model's own type-0 textures that are not
 * already in it. The display entries keep their positions, which the replaceable-type
 * lookups index by.
 * @param {number[]|null|undefined} display_textures - fileDataIDs from the item display
 * @param {Array<{fileDataID: number}>|null|undefined} m2_textures - the model's texture list
 * @param {number[]|null|undefined} m2_texture_types - the model's texture types, same order
 * @returns {number[]}
 */
function with_embedded_textures(display_textures, m2_textures, m2_texture_types) {
	const result = Array.isArray(display_textures) ? [...display_textures] : [];
	if (!m2_textures || !m2_texture_types)
		return result;

	const seen = new Set(result.filter(id => id > 0));
	for (let i = 0; i < m2_textures.length; i++) {
		if (m2_texture_types[i] !== 0)
			continue;

		const file_data_id = m2_textures[i]?.fileDataID;
		if (!(file_data_id > 0) || seen.has(file_data_id))
			continue;

		seen.add(file_data_id);
		result.push(file_data_id);
	}

	return result;
}

module.exports = { with_embedded_textures };
