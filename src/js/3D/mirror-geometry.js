/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Mirror off-hand (wow-to-stl #317): make the off-hand weapon a real left-hand copy, the mirror
	image of the same weapon held in the right hand (Kara, 2026-11-14).

	The right hand holds the item as R_R v (R_R: the right-hand attachment's rotation in the
	character's model space). Its mirror image across the character's left/right plane is
	M R_R v, M = flip of the loaded model space's Z axis (M2 Y, the character's left/right; the
	loader reads M2 X, Y, Z as x, -z, y). Held in the left hand, R_L N v must equal M R_R v, so
	the item itself is transformed by N = R_L^-1 M R_R. N is snapped to the nearest signed axis
	permutation (a pure mirror about one of the item's own axes, maybe turned a quarter), so a
	slightly uneven stance can't tilt the weapon. N is applied to the item's own data (vertices,
	normals, triangle winding), so the viewer and every exporter read the same mirrored mesh and
	it stays on its grip (the origin).
 */

const MIRROR_LR = [1, 0, 0, 0, 1, 0, 0, 0, -1];     // row-major 3x3: the character's left/right flipped

/** Row-major 3x3 rotation part of a column-major 4x4 (WebGL) matrix, columns normalised (attachment bones carry a scale). */
function rotation_of(m4) {
	const r = new Array(9);
	for (let c = 0; c < 3; c++) {
		const x = m4[c * 4], y = m4[c * 4 + 1], z = m4[c * 4 + 2];
		const len = Math.hypot(x, y, z) || 1;
		r[c] = x / len;
		r[3 + c] = y / len;
		r[6 + c] = z / len;
	}
	return r;
}

function mul3(a, b) {
	const out = new Array(9);
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++)
			out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
	}
	return out;
}

function transpose3(a) {
	return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
}

function det3(a) {
	return a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
}

/**
 * The nearest signed axis permutation to `a` (each row and column one +-1): the best of the
 * 48 such matrices by sum of products.
 */
function snap_signed_permutation(a) {
	const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
	let best = null, best_score = -Infinity;
	for (const p of perms) {
		let score = 0;
		const m = new Array(9).fill(0);
		for (let row = 0; row < 3; row++) {
			const v = a[row * 3 + p[row]];
			m[row * 3 + p[row]] = v < 0 ? -1 : 1;
			score += Math.abs(v);
		}
		if (score > best_score) {
			best_score = score;
			best = m;
		}
	}
	return best;
}

/**
 * The item-space mirror N for a real left-hand copy, from the left- and right-hand attachment
 * transforms (column-major 4x4, model space). Without both, the character's left/right flip.
 * @returns {number[]} row-major 3x3, a signed permutation with determinant -1
 */
function left_hand_mirror(left_m4, right_m4) {
	if (!left_m4 || !right_m4)
		return MIRROR_LR.slice();

	const n = snap_signed_permutation(mul3(transpose3(rotation_of(left_m4)), mul3(MIRROR_LR, rotation_of(right_m4))));
	return det3(n) < 0 ? n : MIRROR_LR.slice();
}

/** Multiply packed XYZ triples by row-major 3x3 `m`, in place. */
function transform_xyz(xyz, m) {
	if (!xyz)
		return;

	for (let i = 0; i + 2 < xyz.length; i += 3) {
		const x = xyz[i], y = xyz[i + 1], z = xyz[i + 2];
		xyz[i] = m[0] * x + m[1] * y + m[2] * z;
		xyz[i + 1] = m[3] * x + m[4] * y + m[5] * z;
		xyz[i + 2] = m[6] * x + m[7] * y + m[8] * z;
	}
}

/** Reverse each triangle's winding in a flat index list, in place (2nd and 3rd index swapped, so submesh ranges stay valid). */
function reverse_winding(triangles) {
	if (!triangles)
		return;

	for (let i = 0; i + 2 < triangles.length; i += 3) {
		const t = triangles[i + 1];
		triangles[i + 1] = triangles[i + 2];
		triangles[i + 2] = t;
	}
}

function transform_m2(m2, m) {
	transform_xyz(m2.vertices, m);
	transform_xyz(m2.normals, m);     // m is orthogonal: normals take the same matrix
	if (det3(m) < 0) {
		for (const skin of m2.skins ?? []) {
			if (skin?.isLoaded)
				reverse_winding(skin.triangles);
		}
	}
}

function same3(a, b) {
	if (!a || !b)
		return a === b || (!a && !b);

	return a.every((v, i) => v === b[i]);
}

/**
 * Set the mirror on a loaded M2's own geometry: undo the one applied (m2.mirror_matrix) and
 * apply `m` (row-major 3x3 signed permutation), or none for null.
 * @returns {boolean} true when the geometry changed
 */
function set_m2_mirror(m2, m) {
	const current = m2.mirror_matrix ?? null;
	if (same3(current, m ?? null))
		return false;

	if (current)
		transform_m2(m2, transpose3(current));     // a signed permutation's inverse is its transpose

	if (m)
		transform_m2(m2, m);

	m2.mirror_matrix = m ? m.slice() : null;
	return true;
}

module.exports = { MIRROR_LR, rotation_of, snap_signed_permutation, left_hand_mirror, transform_xyz, reverse_winding, set_m2_mirror };
