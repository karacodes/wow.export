/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Which geosets a character's customization choices turn on (wow-to-stl #122). A choice can
	have several ChrCustomizationElement rows with a geoset, and a row with a
	RelatedChrCustomizationChoiceID only counts while that other choice is also picked (the
	same rule apply_customization_textures follows for material rows). The old cache kept one
	geoset per choice, the last row read, so the rest of a choice's geosets never showed. A group
	a picked choice shows a geoset in drops its other geosets, the ..01 default too (wow-to-stl #226).
*/

/**
 * Record one ChrCustomizationElement row's geoset under its choice.
 * @param {Map<number, Array<{geoset: number, related: number}>>} choice_geosets - mutated
 * @param {object} row - ChrCustomizationElement row
 */
function add_element(choice_geosets, row) {
	if (!row.ChrCustomizationGeosetID)
		return;

	const choice_id = row.ChrCustomizationChoiceID;
	if (!choice_geosets.has(choice_id))
		choice_geosets.set(choice_id, []);

	choice_geosets.get(choice_id).push({ geoset: row.ChrCustomizationGeosetID, related: row.RelatedChrCustomizationChoiceID || 0 });
}

/**
 * The ChrCustomizationGeoset ids a choice turns on while the given choices are picked:
 * every row with no condition, and every row whose related choice is picked.
 * @param {Array<{geoset: number, related: number}>|undefined} elements - the choice's rows
 * @param {Set<number>} active_choice_ids
 * @returns {number[]}
 */
function active_geosets(elements, active_choice_ids) {
	const out = [];
	for (const element of elements || []) {
		if (element.related !== 0 && !active_choice_ids.has(element.related))
			continue;

		if (!out.includes(element.geoset))
			out.push(element.geoset);
	}

	return out;
}

/**
 * Every ChrCustomizationGeoset id a choice names, whatever its conditions.
 * @param {Array<{geoset: number, related: number}>|undefined} elements
 * @returns {number[]}
 */
function all_geosets(elements) {
	const out = [];
	for (const element of elements || []) {
		if (!out.includes(element.geoset))
			out.push(element.geoset);
	}

	return out;
}

/**
 * Geoset group of a geoset id (Hair 5 = 0, Jaw 102 = 1, Sleeves 803 = 8).
 * @param {number} id
 * @returns {number}
 */
const group_of = id => Math.floor(id / 100);

/**
 * Turn the active choices' geosets on and the other choices' geosets of the same options off.
 * Everything an option's choices name is switched off first and the picked choices' geosets
 * on after, so a geoset two choices share ends up on when the picked one has it, whatever
 * order the choices come in.
 *
 * A group a picked choice shows a geoset in keeps only the picked geosets: the rest of the
 * group (ids group*100+1..+99, the range the equipment pass hides) goes off, so the group's
 * ..01 default no longer shows under it (wow-to-stl #226). A choice's plain variant usually
 * has no element row, so the default is not among the geosets any choice names.
 * @param {Array<{id: number, checked: boolean}>} geosets - geoset checkbox rows, mutated
 * @param {Array<{optionID: number, choiceID: number}>} active_choices
 * @param {(option_id: number) => Array<{id: number}>|undefined} choices_for_option
 * @param {(choice_id: number) => Array<{geoset: number, related: number}>|undefined} choice_elements
 * @param {(chr_cust_geoset_id: number) => number|undefined} geoset_value - ChrCustomizationGeoset id -> geoset id
 */
function apply_choice_geosets(geosets, active_choices, choices_for_option, choice_elements, geoset_value) {
	const active_ids = new Set(active_choices.map(choice => choice.choiceID));
	const off = new Set();
	const on = new Set();

	for (const active_choice of active_choices) {
		const available_choices = choices_for_option(active_choice.optionID);
		if (!available_choices)
			continue;

		for (const available_choice of available_choices) {
			const elements = choice_elements(available_choice.id);
			for (const chr_cust_geoset_id of all_geosets(elements))
				off.add(geoset_value(chr_cust_geoset_id));

			if (available_choice.id === active_choice.choiceID) {
				for (const chr_cust_geoset_id of active_geosets(elements, active_ids))
					on.add(geoset_value(chr_cust_geoset_id));
			}
		}
	}

	const on_groups = new Set();
	for (const id of on) {
		if (id > 0)
			on_groups.add(group_of(id));
	}

	for (const geoset of geosets) {
		if (geoset.id === 0)
			continue;

		if (on.has(geoset.id))
			geoset.checked = true;
		else if (off.has(geoset.id))
			geoset.checked = false;
		else if (on_groups.has(group_of(geoset.id)) && geoset.id % 100 !== 0)
			geoset.checked = false;
	}
}

module.exports = { add_element, active_geosets, all_geosets, apply_choice_geosets, group_of };
