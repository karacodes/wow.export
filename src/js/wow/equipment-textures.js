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

// the exporters read replaceable textures by position: types 2-4 at index type - 2 and
// types 11-13 at index type - 11, so positions 0-2 belong to the display
const REPLACEABLE_SLOTS = 3;

/**
 * The display's texture list, padded with 0 to the three replaceable positions, followed
 * by the model's own type-0 textures that are not already in it. The display entries keep
 * their positions and the embedded ones never take a replaceable position.
 * @param {number[]|null|undefined} display_textures - fileDataIDs from the item display
 * @param {Array<{fileDataID: number}>|null|undefined} m2_textures - the model's texture list
 * @param {number[]|null|undefined} m2_texture_types - the model's texture types, same order
 * @returns {number[]}
 */
function with_embedded_textures(display_textures, m2_textures, m2_texture_types) {
	const result = Array.isArray(display_textures) ? [...display_textures] : [];
	if (!m2_textures || !m2_texture_types)
		return result;

	const embedded = [];
	const seen = new Set(result.filter(id => id > 0));
	for (let i = 0; i < m2_textures.length; i++) {
		if (m2_texture_types[i] !== 0)
			continue;

		const file_data_id = m2_textures[i]?.fileDataID;
		if (!(file_data_id > 0) || seen.has(file_data_id))
			continue;

		seen.add(file_data_id);
		embedded.push(file_data_id);
	}

	if (embedded.length === 0)
		return result;

	while (result.length < REPLACEABLE_SLOTS)
		result.push(0);

	result.push(...embedded);
	return result;
}

module.exports = { REPLACEABLE_SLOTS, with_embedded_textures };
