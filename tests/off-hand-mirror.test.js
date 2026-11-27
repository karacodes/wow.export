/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Mirror off-hand (wow-to-stl #317): with the character tab's Off-hand option on Mirrored, the
	off-hand weapon is a real left-hand copy (Kara, 2026-11-14): held in the left hand it is the
	mirror image, across the character's left/right plane, of the same weapon in the right hand.
	The mirror is applied to the item's own data with the triangles turned back out, can be undone,
	and leaves shields, off-hand books and orbs and the main hand alone.
	The first version flipped the loaded data's Y, which is the item's up/down (the loader reads
	M2 X, Y, Z as x, -z, y): Kara saw the weapon flip the wrong way.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mirrors_off_hand } = require('../src/js/wow/EquipmentSlots');
const { MIRROR_LR, left_hand_mirror, off_hand_mirror_matrix, snap_signed_permutation, transform_xyz, reverse_winding, set_m2_mirror } = require('../src/js/3D/mirror-geometry');
const { bone_matrix_at } = require('../src/js/3D/bone-matrix');

const MAIN_HAND = 16, OFF_HAND = 17;
const INV = { ONE_HAND: 13, SHIELD: 14, WEAPON_MAIN_HAND: 21, WEAPON_OFF_HAND: 22, HOLDABLE: 23 };

test('only an off-hand weapon is mirrored', () => {
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.ONE_HAND }), true);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.WEAPON_OFF_HAND }), true);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.SHIELD }), false);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.HOLDABLE }), false);
	assert.equal(mirrors_off_hand(MAIN_HAND, { inventory_type: INV.ONE_HAND }), false);
	assert.equal(mirrors_off_hand(MAIN_HAND, { inventory_type: INV.WEAPON_MAIN_HAND }), false);
});

// row-major 3x3 helpers
const mul = (a, b) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
const apply = (m, v) => [0, 1, 2].map(i => m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2]);
const rot = (axis, deg) => {
	const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
	if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
	if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
	return [c, -s, 0, s, c, 0, 0, 0, 1];
};
// column-major 4x4 (WebGL) from a row-major 3x3, a scale and a translation
const m4 = (r, scale = 1, t = [0, 0, 0]) => [
	r[0] * scale, r[3] * scale, r[6] * scale, 0,
	r[1] * scale, r[4] * scale, r[7] * scale, 0,
	r[2] * scale, r[5] * scale, r[8] * scale, 0,
	t[0], t[1], t[2], 1];
const close = (a, b, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${msg}: ${a} vs ${b}`));

test('the off hand holds the mirror image of the right hand\'s weapon', () => {
	// a right-hand grip and three left-hand grips: the mirror-symmetric one, and two with the
	// left attachment turned a half or quarter turn in its own frame, as rigs do
	const right = mul(rot('z', 90), rot('x', 90));
	const mirrored_right = mul(mul(MIRROR_LR, right), MIRROR_LR);
	const lefts = [mirrored_right, mul(mirrored_right, rot('x', 180)), mul(mirrored_right, rot('y', 90))];
	const blade = [[0.1, 0.02, 0.9], [0.3, -0.05, 0.1], [-0.02, 0.4, 0.2]];
	for (const left of lefts) {
		const n = left_hand_mirror(m4(left, 0.83, [0.2, 1, -0.3]), m4(right, 0.83, [0.2, 1, 0.3]));
		for (const v of blade)
			close(apply(left, apply(n, v)), apply(MIRROR_LR, apply(right, v)), 'left-hand copy');
	}
});

test('a slightly uneven stance gives the same clean mirror', () => {
	const right = mul(rot('z', 90), rot('x', 90));
	const left = mul(mul(mul(MIRROR_LR, right), MIRROR_LR), rot('x', 180));
	const exact = left_hand_mirror(m4(left), m4(right));
	const tilted = left_hand_mirror(m4(mul(left, rot('y', 7))), m4(mul(right, rot('z', -5))));
	assert.deepEqual(tilted, exact);
	assert.deepEqual(snap_signed_permutation([0.9, 0.1, 0, -0.1, 0.2, -0.95, 0, 0.98, 0.1]), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
});

test('without hand attachments it falls back to the left/right flip, not the item\'s up/down', () => {
	assert.deepEqual(left_hand_mirror(null, null), MIRROR_LR);
	assert.deepEqual(MIRROR_LR, [1, 0, 0, 0, 1, 0, 0, 0, -1]);
});

// wow-to-stl #343: a Dracthyr export with Off-hand Mirrored threw "Cannot read properties of
// null (reading '0')" in det3 <- left_hand_mirror. Its hand bones are past the 256 bone matrices
// the renderer holds, so the hand transforms came out NaN and the snap returned null.
test('a NaN hand transform falls back to the left/right flip instead of throwing (#343)', () => {
	const right = m4(mul(rot('z', 90), rot('x', 90)), 0.83, [0.2, 1, 0.3]);
	const nan = new Float32Array(16).fill(NaN);
	assert.deepEqual(left_hand_mirror(nan, right), MIRROR_LR);
	assert.deepEqual(left_hand_mirror(right, nan), MIRROR_LR);
	assert.deepEqual(left_hand_mirror(nan, nan), MIRROR_LR);
	const one_nan = [...right];
	one_nan[5] = NaN;
	assert.deepEqual(left_hand_mirror(one_nan, right), MIRROR_LR);
	assert.deepEqual(left_hand_mirror(right.slice(0, 8), right), MIRROR_LR, 'a short matrix');
	assert.deepEqual(snap_signed_permutation(new Array(9).fill(NaN)), MIRROR_LR);
	assert.deepEqual(snap_signed_permutation([1, 0, 0, 0, Infinity, 0, 0, 0, 1]), MIRROR_LR);
});

test('the hands are read only when the option is on and an item can be mirrored (#343)', () => {
	let reads = 0;
	const hands = () => { reads++; return [new Float32Array(16).fill(NaN), null]; };
	assert.equal(off_hand_mirror_matrix(true, false, hands), null, 'no off-hand weapon: nothing to mirror');
	assert.equal(off_hand_mirror_matrix(false, true, hands), null, 'option off');
	assert.equal(reads, 0);
	assert.deepEqual(off_hand_mirror_matrix(true, true, hands), MIRROR_LR);
	assert.equal(reads, 1);
	const right = mul(rot('z', 90), rot('x', 90));
	const left = mul(mul(MIRROR_LR, right), MIRROR_LR);
	assert.deepEqual(off_hand_mirror_matrix(true, true, () => [m4(left), m4(right)]), left_hand_mirror(m4(left), m4(right)));
});

test('a bone past the renderer\'s matrices has no matrix (#343)', () => {
	const mats = new Float32Array(256 * 16);
	mats.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1], 255 * 16);
	assert.deepEqual([...bone_matrix_at(mats, 255)], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]);
	assert.equal(bone_matrix_at(mats, 255).length, 16);
	assert.equal(bone_matrix_at(mats, 256), null);
	assert.equal(bone_matrix_at(mats, 300), null);
	assert.equal(bone_matrix_at(mats, -1), null);
	assert.equal(bone_matrix_at(null, 0), null);
	assert.equal(bone_matrix_at(mats.subarray(0, 20), 1), null, 'a partial last matrix');
});

// a lopsided tetrahedron, faces wound outward
const VERTS = [0, 0, 0, 0.2, 0, 0, 0, 0.3, 0, 0, 0, 0.5];
const NORMALS = [0, 0, -1, 0, 1, 0, 0, 1, 0, 0, 0, 1];
const TRIS = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
const signed_volume = (v, t) => {
	let vol = 0;
	for (let i = 0; i < t.length; i += 3) {
		const [a, b, c] = [t[i], t[i + 1], t[i + 2]].map(k => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]]);
		vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
	}
	return vol / 6;
};
const make_m2 = () => ({ vertices: new Float32Array(VERTS), normals: new Float32Array(NORMALS),
	skins: [{ isLoaded: true, triangles: new Uint16Array(TRIS) }, { isLoaded: false }] });

test('the mirror moves the item\'s own data, faces still out, and comes off again', () => {
	const m2 = make_m2();
	const n = [0, 0, -1, 0, 1, 0, -1, 0, 0];     // a mirror with a quarter turn
	assert.equal(set_m2_mirror(m2, n), true);
	const want = new Float32Array(VERTS);
	transform_xyz(want, n);
	assert.deepEqual([...m2.vertices], [...want]);
	assert.ok(signed_volume(m2.vertices, m2.skins[0].triangles) > 0, 'the mirrored faces point inward');
	for (let i = 0; i < TRIS.length; i += 3)       // submesh ranges still cover the same triangles
		assert.deepEqual([...m2.skins[0].triangles.slice(i, i + 3)].sort(), TRIS.slice(i, i + 3).sort());
	assert.equal(set_m2_mirror(m2, n), false, 'the same mirror twice changes nothing');
	assert.equal(set_m2_mirror(m2, MIRROR_LR), true, 'another mirror replaces it');
	const want_lr = new Float32Array(VERTS);
	transform_xyz(want_lr, MIRROR_LR);
	assert.deepEqual([...m2.vertices], [...want_lr]);
	assert.equal(set_m2_mirror(m2, null), true);
	assert.deepEqual([...m2.vertices], [...new Float32Array(VERTS)]);
	assert.deepEqual([...m2.normals], [...new Float32Array(NORMALS)]);
	assert.deepEqual([...m2.skins[0].triangles], TRIS);
	assert.equal(set_m2_mirror(m2, null), false);
});

test('helpers work in place and tolerate missing data', () => {
	const tris = [0, 1, 2, 3, 4, 5];
	reverse_winding(tris);
	assert.deepEqual(tris, [0, 2, 1, 3, 5, 4]);
	transform_xyz(null, MIRROR_LR);
	reverse_winding(undefined);
	assert.equal(set_m2_mirror({ vertices: null, normals: null }, MIRROR_LR), true);
});
