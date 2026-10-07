/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The cape texture of the equipped Back item. Most cloaks have no model of their
	own: the character model's cloak geoset wears the item's texture through the
	replaceable texture type 2 (M2 texture type "cape"). Neither upstream nor the
	fork bound it, so a plain cloak showed the viewer's blank texture and exported
	with no material (Kara, 2026-10-07: the gnome male's cape has no texture).
*/

const BACK_SLOT = 15;
const CAPE_TEXTURE_TYPE = 2;

/**
 * The texture file to bind as the character's cape for an item display, or 0.
 * The display's texture tagged type 2 wins; a display with textures but no model of
 * its own (a plain cloak) uses its first texture; a modelled item with no type-2
 * texture (a 3D cape, a backpack) contributes nothing to the body's cloak geoset.
 * @param {{models?: number[], textures?: number[], texturesByType?: Object<number, number[]>}|null} display
 * @returns {number}
 */
function cape_texture_for_display(display) {
	if (!display)
		return 0;

	const typed = display.texturesByType?.[CAPE_TEXTURE_TYPE];
	if (typed && typed.length > 0 && typed[0] > 0)
		return typed[0];

	const has_models = Array.isArray(display.models) && display.models.length > 0;
	if (!has_models && display.textures && display.textures.length > 0 && display.textures[0] > 0)
		return display.textures[0];

	return 0;
}

/**
 * The variant texture list for the character's M2Exporter: index n is replaceable
 * texture type n + 2, so the cape goes first.
 * @param {number} cape_file_data_id
 * @returns {number[]}
 */
function character_variant_textures(cape_file_data_id) {
	return [cape_file_data_id > 0 ? cape_file_data_id : 0];
}

module.exports = {
	BACK_SLOT,
	CAPE_TEXTURE_TYPE,
	cape_texture_for_display,
	character_variant_textures
};
