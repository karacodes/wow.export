/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Bone tracks keyed by a global sequence (wow-to-stl #341). An M2 track whose globalSeq is set
	holds one key list, played on the model's global clock whatever animation runs, instead of
	one key list per animation. The character models' sheath points (26, 27, 32, 33) are bones
	whose only key is a fixed rotation in such a track: it is what turns a sheathed weapon blade
	down across the back or along the hip. Reading the track by the current animation's index
	missed it (or, by chance, used it only while animation 0 ran), so a weapon on a sheath point
	kept the body's axes and pointed its blade up. The game and Wowhead's viewer read it on the
	global clock.
 */

// a track with no global sequence stores -1 (read as an unsigned 16-bit 65535)
const NO_GLOBAL_SEQ = 65535;

/**
 * @param {object} track - M2Track (globalSeq, interpolation, timestamps, values)
 * @returns {boolean} true when the track plays on a global sequence
 */
const has_global_seq = (track) => {
	const gs = track?.globalSeq;
	return Number.isInteger(gs) && gs >= 0 && gs !== NO_GLOBAL_SEQ;
};

/**
 * The keys a track gives while animation `anim_idx` runs: its own list for that animation, or
 * the global sequence's single list. Null when it has none.
 * @param {object} track
 * @param {number} anim_idx
 * @returns {{ timestamps: number[], values: Array, global_seq: number|null }|null}
 */
const track_keys = (track, anim_idx) => {
	if (!track)
		return null;

	const global = has_global_seq(track);
	const slot = global ? 0 : anim_idx;
	const timestamps = track.timestamps?.[slot];
	const values = track.values?.[slot];
	if (!timestamps?.length || !values?.length)
		return null;

	return { timestamps, values, global_seq: global ? track.globalSeq : null };
};

/**
 * A copy of the track with the global sequence's keys under every one of `animation_count`
 * animations, for writers that only know per-animation keys (glTF has no global clock). Any
 * other track comes back as it is.
 * @param {object} track
 * @param {number} animation_count
 * @returns {object}
 */
const spread_global_track = (track, animation_count) => {
	if (!has_global_seq(track) || !track.timestamps?.[0]?.length || !track.values?.[0]?.length)
		return track;

	const copy = Object.assign(Object.create(Object.getPrototypeOf(track)), track);
	copy.timestamps = Array.from({ length: animation_count }, () => track.timestamps[0]);
	copy.values = Array.from({ length: animation_count }, () => track.values[0]);
	return copy;
};

/**
 * The bone with its global-sequence tracks spread over every animation (see spread_global_track),
 * or the bone itself when it has none.
 * @param {object} bone
 * @param {number} animation_count
 * @returns {object}
 */
const with_global_tracks = (bone, animation_count) => {
	if (!bone || !['translation', 'rotation', 'scale'].some(k => has_global_seq(bone[k])))
		return bone;

	const copy = Object.assign(Object.create(Object.getPrototypeOf(bone)), bone);
	for (const k of ['translation', 'rotation', 'scale'])
		copy[k] = spread_global_track(bone[k], animation_count);

	return copy;
};

module.exports = { NO_GLOBAL_SEQ, has_global_seq, track_keys, spread_global_track, with_global_tracks };
