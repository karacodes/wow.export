/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The M2 blend mode of each mesh an equipped item exports as. The sidecar's equipment row
	lists them by OBJ group name (`meshBlendModes`), so WoW Print can tell a glow card the
	game draws additive from a solid part: the gnome male's helm 228858 has a flat ember
	quad (Head_Item228858_1) as tall as the figure that printed as a slab above the head
	(2026-10-07). M2 blend modes: 0 opaque, 1 alpha key, 2 alpha, 3 no-alpha add, 4 add,
	5 mod, 6 mod2x, 7 blend add.
*/

/**
 * The blend mode the game draws skin section `section_index` with, or null when no texture
 * unit or material says (the first texture unit of the section decides, as in the viewer).
 * @param {{materials?: {blendingMode: number}[]}} m2
 * @param {{textureUnits?: {skinSectionIndex: number, materialIndex: number}[]}} skin
 * @param {number} section_index
 * @returns {number|null}
 */
function section_blend_mode(m2, skin, section_index) {
	const unit = skin?.textureUnits?.find(tex => tex.skinSectionIndex === section_index);
	if (!unit)
		return null;

	const mode = m2?.materials?.[unit.materialIndex]?.blendingMode;
	return Number.isInteger(mode) ? mode : null;
}

/**
 * The sidecar's `meshBlendModes`: mesh name -> blend mode, for the meshes that have one.
 * @param {string[]} names
 * @param {(number|null)[]} modes - parallel to names
 * @returns {Object<string, number>}
 */
function blend_modes_by_mesh(names, modes) {
	const out = {};
	for (let i = 0; i < (names?.length ?? 0); i++) {
		if (Number.isInteger(modes?.[i]))
			out[names[i]] = modes[i];
	}
	return out;
}

module.exports = { section_blend_mode, blend_modes_by_mesh };
