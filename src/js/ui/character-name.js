/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
 */

// The print export names the character in its sidecar (character.name) so WoW Print can call
// the STL after it. The viewer knows a name from two places: the saved character it loaded
// or saved (My Characters, the print batch) and the Battle.net armory import. The saved name
// wins: a character imported from the armory and then saved as "Lockspanner" is Lockspanner.
// A character built by hand from the customization panels has no name.

const clean = (name) => (typeof name === 'string' && name.trim().length > 0) ? name.trim() : null;

/**
 * The sidecar's name and where it came from, or null for both when the viewer knows none.
 * @param {?string} saved_name - the loaded or just-saved character's name in My Characters
 * @param {?string} armory_name - the name the character was imported from the armory under
 * @returns {{ name: ?string, source: ?string }} source is 'saved' or 'armory'
 */
function character_name(saved_name, armory_name) {
	const saved = clean(saved_name);
	if (saved)
		return { name: saved, source: 'saved' };

	const armory = clean(armory_name);
	if (armory)
		return { name: armory, source: 'armory' };

	return { name: null, source: null };
}

module.exports = { character_name };
