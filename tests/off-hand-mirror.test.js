/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Mirror off-hand (wow-to-stl #317): with the character tab's Off-hand option on Mirrored, the
	off-hand weapon's own model data is flipped left to right (M2 Y) with its triangles turned
	back out, so the viewer and every export read the same mirror image. Shields and off-hand
	books and orbs are left as they are; the main hand too. Mirroring twice restores the model.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mirrors_off_hand } = require('../src/js/wow/EquipmentSlots');
const { negate_y, reverse_winding, mirror_m2_geometry } = require('../src/js/3D/mirror-geometry');

const MAIN_HAND = 16, OFF_HAND = 17;
const INV = { ONE_HAND: 13, SHIELD: 14, WEAPON_OFF_HAND: 22, HOLDABLE: 23, WEAPON_MAIN_HAND: 21 };

test('only an off-hand weapon is mirrored', () => {
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.ONE_HAND }), true);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.WEAPON_OFF_HAND }), true);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.SHIELD }), false);
	assert.equal(mirrors_off_hand(OFF_HAND, { inventory_type: INV.HOLDABLE }), false);
	assert.equal(mirrors_off_hand(MAIN_HAND, { inventory_type: INV.ONE_HAND }), false);
	assert.equal(mirrors_off_hand(MAIN_HAND, { inventory_type: INV.WEAPON_MAIN_HAND }), false);
});

// a lopsided tetrahedron, faces wound outward
const VERTS = [0, 0, 0, 0.2, 0, 0, 0, 0.3, 0, 0, 0, 0.5];
const NORMALS = [0, 0, -1, 0, 1, 0, 0, 1, 0, 0, 0, 1];
const TRIS = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];

function signed_volume(v, tris) {
	let vol = 0;
	for (let i = 0; i < tris.length; i += 3) {
		const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]].map(k => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]]);
		vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
	}
	return vol / 6;
}

function make_m2() {
	return {
		vertices: new Float32Array(VERTS),
		normals: new Float32Array(NORMALS),
		skins: [{ isLoaded: true, triangles: new Uint16Array(TRIS) }, { isLoaded: false, triangles: undefined }]
	};
}

test('the mirror flips Y on vertices and normals and keeps the faces pointing out', () => {
	const m2 = make_m2();
	assert.ok(signed_volume(m2.vertices, m2.skins[0].triangles) > 0);
	const v32 = new Float32Array(VERTS), n32 = new Float32Array(NORMALS);
	mirror_m2_geometry(m2);
	assert.equal(m2.mirrored, true);
	for (let i = 0; i < VERTS.length; i += 3) {
		assert.equal(m2.vertices[i], v32[i]);
		assert.equal(m2.vertices[i + 1], -v32[i + 1]);
		assert.equal(m2.vertices[i + 2], v32[i + 2]);
		assert.equal(m2.normals[i], n32[i]);
		assert.equal(m2.normals[i + 1], -n32[i + 1]);
	}
	assert.ok(signed_volume(m2.vertices, m2.skins[0].triangles) > 0, 'the mirrored faces point inward');
	assert.equal(m2.skins[0].triangles.length, TRIS.length);
	// submesh ranges (multiples of 3) still cover the same triangles: only each triple's order changed
	for (let i = 0; i < TRIS.length; i += 3)
		assert.deepEqual([...m2.skins[0].triangles.slice(i, i + 3)].sort(), TRIS.slice(i, i + 3).sort());
});

test('mirroring twice restores the model', () => {
	const m2 = make_m2();
	mirror_m2_geometry(m2);
	mirror_m2_geometry(m2);
	assert.equal(m2.mirrored, false);
	assert.deepEqual([...m2.vertices], [...new Float32Array(VERTS)]);
	assert.deepEqual([...m2.normals], [...new Float32Array(NORMALS)]);
	assert.deepEqual([...m2.skins[0].triangles], TRIS);
});

test('helpers work in place and tolerate missing data', () => {
	const xyz = [1, 2, 3, 4, 5, 6];
	negate_y(xyz);
	assert.deepEqual(xyz, [1, -2, 3, 4, -5, 6]);
	const tris = [0, 1, 2, 3, 4, 5];
	reverse_winding(tris);
	assert.deepEqual(tris, [0, 2, 1, 3, 5, 4]);
	negate_y(undefined);
	reverse_winding(null);
	mirror_m2_geometry({ vertices: null, normals: null });
});
