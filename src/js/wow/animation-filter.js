/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The search box over the Characters tab's animation drop-down (F13, Kara 2026-10-08; the
	Models tab keeps its plain list, her choice): typing
	narrows the list to the animations whose label ("AttackUnarmed (16.0)") contains every word
	typed, in any case, so "attack 1h" finds the one-handed attacks and "16." finds by id.
	"No Animation" and the animation chosen now always stay in the list, so the drop-down
	never loses its value while the list is narrowed.
*/

/**
 * @param {{id: string, label: string}[]} animations - the drop-down's entries
 * @param {string} filter - what is typed in the search box
 * @param {string|null} selected - the id chosen now
 * @returns {{id: string, label: string}[]}
 */
function filter_animations(animations, filter, selected = null) {
	const list = animations || [];
	const words = String(filter || '').toLowerCase().split(/\s+/).filter(w => w.length > 0);
	if (words.length === 0)
		return list;

	return list.filter(anim => {
		if (anim.id === 'none' || anim.id === selected)
			return true;

		const label = String(anim.label || '').toLowerCase();
		return words.every(w => label.includes(w));
	});
}

module.exports = { filter_animations };
