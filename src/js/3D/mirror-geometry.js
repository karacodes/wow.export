/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Mirror off-hand (wow-to-stl #317): flip an item model left to right in its own space.
	At rest an attachment is a pure translation in the character's model space, so an item's
	axes are the character's and its left/right axis is M2 Y. Mirroring negates Y on every
	vertex and normal and reverses each triangle's winding so the faces still point out. The
	item stays on its attachment point (the grip is the origin), and the viewer and every
	exporter read the same mirrored data.
 */

/**
 * Negate the Y component of packed XYZ triples, in place.
 * @param {Float32Array|number[]} xyz
 */
function negate_y(xyz) {
	if (!xyz)
		return;

	for (let i = 1; i < xyz.length; i += 3)
		xyz[i] = -xyz[i];
}

/**
 * Reverse the winding of every triangle in a flat index list, in place (swap the 2nd and
 * 3rd index of each triple, so submesh ranges stay valid).
 * @param {Uint16Array|number[]} triangles
 */
function reverse_winding(triangles) {
	if (!triangles)
		return;

	for (let i = 0; i + 2 < triangles.length; i += 3) {
		const t = triangles[i + 1];
		triangles[i + 1] = triangles[i + 2];
		triangles[i + 2] = t;
	}
}

/**
 * Mirror a loaded M2's geometry left to right (M2 Y) in place: vertices, normals and the
 * triangles of every skin already loaded. Mirroring twice restores the model. `m2.mirrored`
 * says which way it stands.
 * @param {object} m2 - M2Loader (vertices, normals, skins)
 */
function mirror_m2_geometry(m2) {
	negate_y(m2.vertices);
	negate_y(m2.normals);
	for (const skin of m2.skins ?? []) {
		if (skin?.isLoaded)
			reverse_winding(skin.triangles);
	}

	m2.mirrored = !m2.mirrored;
}

module.exports = { negate_y, reverse_winding, mirror_m2_geometry };
