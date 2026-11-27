/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Bone matrix lookup with a bounds check (wow-to-stl #343). A renderer's bone matrices are the
	shader's uniform buffer, which holds at most MAX_BONES (256) matrices. A bone past that has no
	matrix: reading it gives a short subarray, and multiplying with it fills the result with NaN.
	That is what a Dracthyr's hand attachments did with Off-hand Mirrored on.
 */

/**
 * The 4x4 world matrix of bone `bone_idx` in `bone_matrices` (packed column-major 4x4s), or
 * null when the bone has none (negative index, no matrices, or past the end).
 * @param {Float32Array|null} bone_matrices
 * @param {number} bone_idx
 * @returns {Float32Array|null}
 */
function bone_matrix_at(bone_matrices, bone_idx) {
	if (!bone_matrices || !Number.isInteger(bone_idx) || bone_idx < 0)
		return null;

	const offset = bone_idx * 16;
	if (offset + 16 > bone_matrices.length)
		return null;

	return bone_matrices.subarray(offset, offset + 16);
}

module.exports = { bone_matrix_at };
