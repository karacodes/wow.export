/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Races the game draws barefoot. ChrRaces flag 0x2 (DoNotComponentFeet) marks races
	whose feet never take an item texture, e.g. tauren hooves: their boots are a model,
	not paint on the body. The characters and creatures tabs composited every item
	texture section, so a tauren in boots got the boot texture on its hooves, and the
	texture layers carried it into the print's surface detail (wow-to-stl #227). Ported
	from marhag87/wow.export 0913d9d2.
*/

// ChrRaces.Flags bit: item textures are not composited onto the feet
const RACE_FLAG_DO_NOT_COMPONENT_FEET = 0x2;

// CharComponentTextureSections.SectionType of the feet (DBItemCharTextures.COMPONENT_SECTION.FOOT)
const FOOT_SECTION = 7;

/**
 * Whether a race with these ChrRaces flags is drawn barefoot.
 * @param {number|null|undefined} race_flags - ChrRaces.Flags
 * @returns {boolean}
 */
function is_bare_feet(race_flags) {
	return ((race_flags ?? 0) & RACE_FLAG_DO_NOT_COMPONENT_FEET) === RACE_FLAG_DO_NOT_COMPONENT_FEET;
}

/**
 * The item textures that are composited onto the body: all of them, less the foot
 * section for a barefoot race.
 * @param {Array<{section: number}>|null|undefined} item_textures - from DBItemCharTextures
 * @param {boolean} bare_feet - the race is drawn barefoot (is_bare_feet)
 * @returns {Array<{section: number}>|null|undefined} the same value when nothing is dropped
 */
function body_item_textures(item_textures, bare_feet) {
	if (!bare_feet || !Array.isArray(item_textures))
		return item_textures;

	return item_textures.filter(texture => texture.section !== FOOT_SECTION);
}

module.exports = { RACE_FLAG_DO_NOT_COMPONENT_FEET, FOOT_SECTION, is_bare_feet, body_item_textures };
