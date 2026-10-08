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

// F14 (Kara 2026-10-08): a Battle.net import's name, realm and region stay with the character
// until she changes race or imports another one; Save stores them in the My Characters JSON
// (`armory`, beside the older top-level `realm` the print batch reads) and loading the save
// brings them back, so exports keep using them.

/**
 * The `armory` block a save stores, or null for a character that was never imported.
 * @param {?string} name - the armory name
 * @param {?string} realm - the realm slug
 * @param {?string} region - e.g. 'us', 'classic-eu'
 * @returns {{ name: string, realm: ?string, region: ?string }|null}
 */
function armory_for_save(name, realm, region) {
	const armory_name = clean(name);
	if (!armory_name)
		return null;

	return { name: armory_name, realm: clean(realm), region: clean(region) };
}

/**
 * The armory name, realm and region a saved character's JSON carries. Saves made before F14
 * have only the top-level `realm` (no armory name or region).
 * @param {object} data - the save's JSON
 * @returns {{ name: ?string, realm: ?string, region: ?string }}
 */
function armory_from_save(data) {
	const armory = (data && typeof data.armory === 'object' && data.armory) || {};
	return {
		name: clean(armory.name),
		realm: clean(armory.realm) ?? clean(data?.realm),
		region: clean(armory.region)
	};
}

/**
 * What the Save box starts with: the character's saved name, else its armory name, else empty.
 * @param {?string} saved_name
 * @param {?string} armory_name
 * @returns {string}
 */
function save_name_suggestion(saved_name, armory_name) {
	return character_name(saved_name, armory_name).name ?? '';
}

module.exports = { character_name, armory_for_save, armory_from_save, save_name_suggestion };
