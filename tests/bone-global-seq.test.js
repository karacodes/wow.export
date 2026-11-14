/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Bone tracks on a global sequence (wow-to-stl #341). The character models' sheath points are
	bones whose only key is a fixed rotation in a global-sequence track (one key list, no matter
	which animation runs). Reading such a track by the current animation's index found nothing
	for any animation but the first, so a sheathed weapon kept the body's axes and pointed its
	blade up (a blood elf's off-hand Kingslayers floated beside his face). The numbers are the
	blood elf male's point 27 bone (207), from the game files: gseq 0, one key.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { NO_GLOBAL_SEQ, has_global_seq, track_keys, with_global_tracks } = require('../src/js/3D/bone-tracks');

const SHEATH_TURN = [0.331, 0.405, -0.625, 0.58];
const STAND = 12;   // any animation but the first

const global_track = () => ({ globalSeq: 0, interpolation: 1, timestamps: [[0]], values: [[SHEATH_TURN]] });
const per_anim_track = (n) => ({
	globalSeq: NO_GLOBAL_SEQ, interpolation: 1,
	timestamps: Array.from({ length: n }, (_, i) => i === STAND ? [0, 500] : []),
	values: Array.from({ length: n }, (_, i) => i === STAND ? [[0, 0, 0, 1], [0, 0, 0.1, 0.995]] : [])
});

test('a global-sequence track gives its keys whatever animation runs', () => {
	const keys = track_keys(global_track(), STAND);
	assert.ok(keys, 'no keys for the sheath bone while Stand runs');
	assert.deepEqual(keys.values[0], SHEATH_TURN);
	assert.equal(keys.global_seq, 0);
});

test('a per-animation track still gives only that animation\'s keys', () => {
	const t = per_anim_track(20);
	assert.equal(has_global_seq(t), false);
	assert.equal(track_keys(t, STAND).timestamps.length, 2);
	assert.equal(track_keys(t, 3), null);
	assert.equal(track_keys(t, STAND).global_seq, null);
});

test('-1 read as signed or unsigned is "no global sequence"', () => {
	assert.equal(has_global_seq({ globalSeq: 65535 }), false);
	assert.equal(has_global_seq({ globalSeq: -1 }), false);
	assert.equal(has_global_seq({ globalSeq: 4 }), true);
});

test('the glTF writer gets the global keys under every animation', () => {
	const bone = { boneID: -1, pivot: [0, 0, 0], translation: per_anim_track(20), rotation: global_track(), scale: per_anim_track(20) };
	const out = with_global_tracks(bone, 20);
	assert.equal(out.rotation.timestamps.length, 20);
	assert.deepEqual(out.rotation.values[STAND][0], SHEATH_TURN);
	assert.equal(out.translation, bone.translation, 'per-animation tracks are left as they are');
	assert.equal(bone.rotation.timestamps.length, 1, 'the source bone is not changed');
	const plain = { translation: per_anim_track(3), rotation: per_anim_track(3), scale: per_anim_track(3) };
	assert.equal(with_global_tracks(plain, 3), plain);
});
