/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Sheathed weapons on the back (wow-to-stl #341): the back sheath points (26, 27) have no tilt
	on the HD character models, so an item hung there as it hangs in the hand pointed its blade
	straight up past the head (a blood elf's off-hand Kingslayers floated beside his face). The
	game hangs it hilt up over the shoulder and blade down, the two crossing at the middle of the
	back. Renderer space: x forward, y up, z to the character's right. A weapon's blade runs along
	its model's +y there (the game's +z), as it does in the hand.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ATTACHMENT_ID, attachment_local_matrix, attachment_turn_quaternion } = require('../src/js/wow/EquipmentSlots');

// the blood elf male's points, in the game's space (x forward, y left, z up)
const POINT = {
	[ATTACHMENT_ID.SHEATH_MAIN_HAND]: [-0.289, -0.205, 1.904],   // behind the right shoulder
	[ATTACHMENT_ID.SHEATH_OFF_HAND]: [-0.259, 0.205, 1.904],     // behind the left shoulder
	[ATTACHMENT_ID.HAND_RIGHT]: [0, 0, 0],
	[ATTACHMENT_ID.LEFT_HIP_SHEATH]: [0.015, 0.212, 1.196]
};

// column-major 4x4 times a direction (w = 0)
const dir = (m, v) => [0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]);
const BLADE = [0, 1, 0];

test('a weapon on a back sheath hangs blade down, not up past the head', () => {
	for (const id of [ATTACHMENT_ID.SHEATH_MAIN_HAND, ATTACHMENT_ID.SHEATH_OFF_HAND]) {
		const blade = dir(attachment_local_matrix(id, POINT[id]), BLADE);
		assert.ok(blade[1] < -0.8, `point ${id}: blade ${blade.map(x => x.toFixed(2))} should point down`);
	}
});

test('the two back blades cross: each tip leans towards the other shoulder', () => {
	const right = dir(attachment_local_matrix(ATTACHMENT_ID.SHEATH_MAIN_HAND, POINT[26]), BLADE);
	const left = dir(attachment_local_matrix(ATTACHMENT_ID.SHEATH_OFF_HAND, POINT[27]), BLADE);
	// main hand behind the right shoulder (z > 0): tip goes left (z < 0), and the other way round
	assert.ok(right[2] < -0.2, `main hand tip z ${right[2].toFixed(2)}`);
	assert.ok(left[2] > 0.2, `off hand tip z ${left[2].toFixed(2)}`);
	// the turn is about the forward axis only: the blade stays flat on the back
	assert.ok(Math.abs(right[0]) < 1e-6 && Math.abs(left[0]) < 1e-6);
});

test('the point itself stays where the game puts it (x, z, -y)', () => {
	const m = attachment_local_matrix(ATTACHMENT_ID.SHEATH_OFF_HAND, POINT[27]);
	assert.deepEqual([m[12], m[13], m[14]].map(x => +x.toFixed(3)), [-0.259, 1.904, -0.205]);
});

test('hands and hips keep the item as it is (no turn)', () => {
	for (const id of [ATTACHMENT_ID.HAND_RIGHT, ATTACHMENT_ID.LEFT_HIP_SHEATH]) {
		const m = attachment_local_matrix(id, POINT[id]);
		assert.deepEqual(Array.from(m.slice(0, 12)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], `point ${id}`);
		assert.equal(attachment_turn_quaternion(id), null);
	}
});

test('the glTF quaternion is the same turn as the matrix', () => {
	for (const id of [ATTACHMENT_ID.SHEATH_MAIN_HAND, ATTACHMENT_ID.SHEATH_OFF_HAND]) {
		const [x, y, z, w] = attachment_turn_quaternion(id);
		// rotate the blade (0, 1, 0) by q: about x only
		assert.equal(y, 0);
		assert.equal(z, 0);
		const blade_q = [0, 1 - 2 * x * x, 2 * x * w];
		const blade_m = dir(attachment_local_matrix(id, POINT[id]), BLADE);
		blade_q.forEach((v, i) => assert.ok(Math.abs(v - blade_m[i]) < 1e-6, `point ${id} axis ${i}`));
	}
});
