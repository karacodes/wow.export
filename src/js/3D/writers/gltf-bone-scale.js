/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Bone scale tracks for glTF animations (wow-to-stl #230, upstream #437).
 */

/**
 * The scale keys to write for one bone in one animation. Bones such as the shoulder
 * attachments often carry scale keys only in animation 0 (Stand); the viewer then holds
 * animation 0's first scale key in every other animation (M2RendererGL has_scale_fallback),
 * so the glTF does the same. The inherited key is written at the start and the end of the
 * clip (once when the clip has no duration), so the bone holds it for the whole animation.
 * @param {object} scale - The bone's scale track: { timestamps: [][], values: [][] } per animation.
 * @param {number} anim_idx - Animation index.
 * @param {number} duration - The animation's duration in milliseconds.
 * @returns {?{timestamps: number[], values: number[][]}} null when the bone has no scale to write.
 */
const get_bone_scale_track = (scale, anim_idx, duration) => {
	const timestamps = scale.timestamps[anim_idx];
	const values = scale.values[anim_idx];
	if (timestamps?.length && values)
		return { timestamps, values };

	if (anim_idx === 0 || !scale.timestamps[0]?.length || !scale.values[0]?.length)
		return null;

	const rest = scale.values[0][0];
	return duration > 0 ? { timestamps: [0, duration], values: [rest, rest] } : { timestamps: [0], values: [rest] };
};

module.exports = { get_bone_scale_track };
