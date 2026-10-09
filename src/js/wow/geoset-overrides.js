/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Hand picks in Custom Geoset Control (wow-to-stl #121, upstream #585): the geosets ticked or
	unticked by hand on the character tab, kept through appearance refreshes and in saved
	characters, so a save loads (and the print batch exports) the way it looked.

	A pick is a geoset whose checkbox differs from the baseline, the state customization and
	gear give it. Only picks are saved, as `geoset_overrides: { show: [ids], hide: [ids] }`,
	never the whole checked list, so a later change to how choices and gear map to geosets
	still reaches old saves. A pick is dropped once its geoset group's baseline changes (a new
	hairstyle, gear in that slot): a fresh choice in the normal controls wins.

	`geosets` below are the checkbox rows (M2RendererGL geosetArray): { id, checked }.
*/

/**
 * Geoset group of a geoset id (Hair 5 = 5, Sleeves 803 = 8).
 * @param {number} id
 * @returns {number}
 */
const group_of = id => Math.floor(id / 100);

/**
 * The checked state of every geoset id. Rows sharing an id count as checked if any is.
 * @param {{id: number, checked: boolean}[]} geosets
 * @returns {Map<number, boolean>}
 */
function snapshot(geosets) {
	const out = new Map();
	for (const geoset of geosets || [])
		out.set(geoset.id, (out.get(geoset.id) ?? false) || !!geoset.checked);
	return out;
}

/**
 * The picks: every geoset whose checkbox differs from the baseline.
 * @param {{id: number, checked: boolean}[]} geosets - the checkboxes now
 * @param {Map<number, boolean>} baseline - from snapshot() right after the last refresh
 * @returns {Map<number, boolean>} geoset id -> checked
 */
function diff(geosets, baseline) {
	const out = new Map();
	for (const [id, checked] of snapshot(geosets)) {
		if (baseline.has(id) && baseline.get(id) !== checked)
			out.set(id, checked);
	}
	return out;
}

/**
 * The geoset groups whose baseline changed between two refreshes.
 * @param {Map<number, boolean>} before
 * @param {Map<number, boolean>} after
 * @returns {Set<number>}
 */
function changed_groups(before, after) {
	const out = new Set();
	for (const [id, checked] of after) {
		if (before.has(id) && before.get(id) !== checked)
			out.add(group_of(id));
	}
	return out;
}

/**
 * The picks that still hold after a refresh: those in a group whose baseline changed are
 * dropped, the rest kept.
 * @param {Map<number, boolean>} overrides
 * @param {Map<number, boolean>|null} before - baseline before the refresh, null for none
 * @param {Map<number, boolean>} after - baseline after it
 * @returns {Map<number, boolean>}
 */
function carry(overrides, before, after) {
	if (!before)
		return new Map(overrides);

	const groups = changed_groups(before, after);
	const out = new Map();
	for (const [id, checked] of overrides) {
		if (!groups.has(group_of(id)))
			out.set(id, checked);
	}
	return out;
}

/**
 * Put the picks on the checkboxes. Ids the model doesn't have are skipped.
 * @param {{id: number, checked: boolean}[]} geosets
 * @param {Map<number, boolean>} overrides
 */
function apply(geosets, overrides) {
	for (const geoset of geosets || []) {
		if (overrides.has(geoset.id))
			geoset.checked = overrides.get(geoset.id);
	}
}

/**
 * The picks as saved in a character file, or undefined when there are none.
 * @param {Map<number, boolean>} overrides
 * @returns {{show: number[], hide: number[]}|undefined}
 */
function to_save(overrides) {
	if (!overrides || overrides.size === 0)
		return undefined;

	const show = [];
	const hide = [];
	for (const [id, checked] of overrides)
		(checked ? show : hide).push(id);

	show.sort((a, b) => a - b);
	hide.sort((a, b) => a - b);
	return { show, hide };
}

/**
 * The picks from a character file's `geoset_overrides`; anything malformed is ignored, and
 * an id listed under both keeps the `show`.
 * @param {*} saved
 * @returns {Map<number, boolean>}
 */
function from_save(saved) {
	const out = new Map();
	if (!saved || typeof saved !== 'object')
		return out;

	for (const [key, checked] of [['hide', false], ['show', true]]) {
		if (!Array.isArray(saved[key]))
			continue;

		for (const id of saved[key]) {
			if (Number.isInteger(id) && id >= 0)
				out.set(id, checked);
		}
	}
	return out;
}

/**
 * The character tab's pick state: the baseline taken at the last refresh, the checkbox rows
 * it was taken on, the picks for the character on screen, and a loaded save's picks waiting
 * for its model to come up.
 * @returns {{baseline: Map<number, boolean>|null, rows: object[]|null, overrides: Map<number, boolean>, pending: {model_id: number, overrides: Map<number, boolean>}|null}}
 */
function create_state() {
	return { baseline: null, rows: null, overrides: new Map(), pending: null };
}

/**
 * The picks for the character on screen: the checkboxes against the last refresh, or the
 * picks carried to rows that have not refreshed yet (a new model of the same character).
 * @param {object} state - from create_state()
 * @param {{id: number, checked: boolean}[]} rows - the checkboxes now
 * @returns {Map<number, boolean>}
 */
function current(state, rows) {
	if (state.baseline !== null && rows === state.rows)
		return diff(rows, state.baseline);

	return new Map(state.overrides);
}

/**
 * Refresh the checkboxes: `reset` sets them from customization and gear (the baseline), then
 * the picks go back on top, except in groups whose baseline this refresh changed.
 * @param {object} state - from create_state()
 * @param {{id: number, checked: boolean}[]} rows
 * @param {function} reset - (rows) => void
 */
function refresh(state, rows, reset) {
	const same_rows = state.baseline !== null && rows === state.rows;
	const picks = current(state, rows);

	reset(rows);

	const baseline = snapshot(rows);
	state.overrides = carry(picks, same_rows ? state.baseline : null, baseline);
	state.baseline = baseline;
	state.rows = rows;
	apply(rows, state.overrides);
}

/**
 * A new character or body type is starting: the last one's picks go, and a queued save's
 * picks come in when it is for this model.
 * @param {object} state - from create_state()
 * @param {number} model_id - the ChrModel id being loaded
 */
function start_character(state, model_id) {
	state.baseline = null;
	state.rows = null;
	state.overrides = new Map();
	if (state.pending && state.pending.model_id === model_id) {
		state.overrides = state.pending.overrides;
		state.pending = null;
	}
}

/**
 * Keep a loaded character file's picks until its model comes up (see start_character).
 * @param {object} state - from create_state()
 * @param {{model_id: number, geoset_overrides?: object}} data
 */
function queue_save(state, data) {
	state.pending = { model_id: data.model_id, overrides: from_save(data.geoset_overrides) };
}

module.exports = { group_of, snapshot, diff, changed_groups, carry, apply, to_save, from_save, create_state, current, refresh, start_character, queue_save };
