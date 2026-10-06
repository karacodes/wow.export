/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
 */

// The character viewer knows two classes: Demon Hunter and Other (any class but a demon
// hunter). Game data gates customization options and choices by a class mask
// (ChrCustomizationReq.ClassMask, bit = class id - 1), so a blood elf's horns, blindfolds
// and tattoos are demon hunter only. The mask decides what the viewer lists and what
// Randomize may pick.

const CLASS_DEMON_HUNTER = 12;
const CLASS_OTHER = 0;

const class_bit = (class_id) => 1 << (class_id - 1);

/**
 * Whether an option or choice with the given class mask is available to the selected class.
 * @param {number} class_mask - ChrCustomizationReq.ClassMask of the entry (0 = no class requirement)
 * @param {number} class_id - the viewer's class: CLASS_DEMON_HUNTER or CLASS_OTHER
 * @returns {boolean}
 */
function is_allowed_for_class(class_mask, class_id) {
	if (!class_mask)
		return true;

	// Other is any class but a demon hunter: only what demon hunters alone may use is out
	if (class_id === CLASS_OTHER)
		return class_mask !== class_bit(CLASS_DEMON_HUNTER);

	return (class_mask & class_bit(class_id)) !== 0;
}

/**
 * Keep the entries ({ class_mask, ... }) the selected class may use.
 */
function filter_for_class(entries, class_id) {
	if (!entries)
		return entries;

	return entries.filter(entry => is_allowed_for_class(entry.class_mask, class_id));
}

module.exports = {
	CLASS_DEMON_HUNTER,
	CLASS_OTHER,
	class_bit,
	is_allowed_for_class,
	filter_for_class
};
