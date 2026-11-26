/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	How each mesh of an equipped item fades in and out in game. The sidecar's equipment row
	lists it by OBJ group name (`meshAlpha`), so WoW Print can find meshes that take turns,
	like the four ghost blades of the Garona daggers (item 128870, model 1348471): each blade
	has a colour alpha track in the Stand animation and the game shows one blade at a time,
	fading between them (wow-to-stl #150). A mesh's visibility is its texture unit's colour
	alpha times its texture weight, as in the model viewer.
*/

const NO_GLOBAL_SEQ = 65535;

/**
 * The keys [[ms, value 0..1], ...] of one int16 track in the first animation (Stand), or in
 * its global sequence, with the loop's length. null when the track has no keys there.
 * @param {object} track - an M2Track (timestamps/values per animation, int16 values)
 * @param {object} m2 - for the animations and global loops
 * @returns {{duration: number, keys: number[][]}|null}
 */
function track_keys(track, m2) {
	if (!track?.timestamps?.length)
		return null;

	const times = track.timestamps[0];
	const values = track.values?.[0];
	if (!times?.length || !values?.length)
		return null;

	const gs = track.globalSeq;
	const global = gs !== undefined && gs !== NO_GLOBAL_SEQ && gs >= 0 && gs < (m2.globalLoops?.length ?? 0);
	const duration = global ? m2.globalLoops[gs] : (m2.animations?.[0]?.duration ?? times[times.length - 1]);
	const keys = [];
	for (let i = 0; i < Math.min(times.length, values.length); i++)
		keys.push([times[i], Math.max(0, Math.min(1, values[i] / 32767))]);

	return { duration, keys };
}

/** Value of keys at time t (linear, held past the ends). */
function value_at(keys, t) {
	if (t <= keys[0][0])
		return keys[0][1];

	for (let i = 1; i < keys.length; i++) {
		if (t <= keys[i][0]) {
			const [t0, v0] = keys[i - 1];
			const [t1, v1] = keys[i];
			return t1 > t0 ? v0 + (v1 - v0) * (t - t0) / (t1 - t0) : v1;
		}
	}

	return keys[keys.length - 1][1];
}

/**
 * How skin section `section_index` fades in the Stand animation: {duration, keys} with keys
 * [[ms, alpha 0..1], ...] (colour alpha times texture weight), or null when its alpha never
 * changes (always shown, always hidden, or no texture unit).
 * @param {object} m2 - colors, textureWeights, transparencyLookup, animations, globalLoops
 * @param {{textureUnits?: object[]}} skin
 * @param {number} section_index
 * @returns {{duration: number, keys: number[][]}|null}
 */
function section_alpha_track(m2, skin, section_index) {
	const unit = skin?.textureUnits?.find(tex => tex.skinSectionIndex === section_index);
	if (!unit || !m2)
		return null;

	const tracks = [];
	const color = unit.colorIndex !== undefined && unit.colorIndex !== 0xFFFF ? m2.colors?.[unit.colorIndex] : null;
	const color_keys = color ? track_keys(color.alpha, m2) : null;
	if (color_keys)
		tracks.push(color_keys);

	const weight_index = m2.transparencyLookup?.[unit.textureWeightComboIndex];
	const weight_keys = weight_index !== undefined ? track_keys(m2.textureWeights?.[weight_index], m2) : null;
	if (weight_keys)
		tracks.push(weight_keys);

	if (!tracks.length)
		return null;

	const duration = Math.max(...tracks.map(tr => tr.duration));
	const times = [...new Set(tracks.flatMap(tr => tr.keys.map(k => k[0])))].sort((a, b) => a - b);
	const keys = times.map(t => [t, Math.round(tracks.reduce((a, tr) => a * value_at(tr.keys, t), 1) * 1000) / 1000]);
	const first = keys[0][1];
	if (keys.every(k => k[1] === first))
		return null;

	return { duration, keys };
}

/**
 * The sidecar's `meshAlpha`: mesh name -> {duration, keys}, for the meshes whose alpha changes.
 * @param {string[]} names
 * @param {(object|null)[]} tracks - parallel to names
 * @returns {Object<string, {duration: number, keys: number[][]}>}
 */
function alpha_tracks_by_mesh(names, tracks) {
	const out = {};
	for (let i = 0; i < (names?.length ?? 0); i++) {
		if (tracks?.[i])
			out[names[i]] = tracks[i];
	}
	return out;
}

module.exports = { track_keys, section_alpha_track, alpha_tracks_by_mesh, value_at };
