/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #230 (upstream Kruithne/wow.export #437, void elf female
	shoulders far too large in glTF): attachment bones such as the shoulders often carry scale
	keys only in animation 0 (Stand). The viewer, and so the OBJ export, falls back to Stand's
	scale for every other animation, but the glTF writer wrote scale only for animations with
	their own keys, so those animations played the bone at scale 1. A tiny two-bone model is
	written through the real GLTFWriter and its animations read back from the files.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// buffer.js loads webp-wasm for WebP export, which this test never uses
const resolve_filename = Module._resolveFilename;
Module._resolveFilename = function(request, ...rest) {
	if (request === 'webp-wasm')
		return request;
	return resolve_filename.call(this, request, ...rest);
};
require.cache['webp-wasm'] = { id: 'webp-wasm', filename: 'webp-wasm', loaded: true, exports: {} };

// the writer pulls in the app's core, generics and export helper, which need nw.js: stand in for the few parts it uses
function stub(request, exports) {
	const file = require.resolve(request);
	const mod = new Module(file, module);
	mod.filename = file;
	mod.loaded = true;
	mod.exports = exports;
	require.cache[file] = mod;
}

// bone prefix nodes on, as "Export for printing" sets them (tab_characters.js)
const config = { modelsExportAnimations: true, modelsExportWithBonePrefix: true, enableAbsoluteGLTFPaths: false };
stub('../src/js/core', { view: { config } });
stub('../src/js/log', { write: () => {} });
stub('../src/js/generics', {
	fileExists: async file => fs.existsSync(file),
	createDirectory: async dir => fs.promises.mkdir(dir, { recursive: true })
});
stub('../src/js/casc/export-helper', {
	replaceExtension: (file, ext = '') => path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext)
});
global.nw = { App: { manifest: { version: 'test', flavour: 'test', guid: 'test' } } };

const GLTFWriter = require('../src/js/3D/writers/GLTFWriter');
const { get_bone_scale_track } = require('../src/js/3D/writers/gltf-bone-scale');

const SHOULDER = [0.75, 0.8, 0.85];
const OWN_SCALE = [1.2, 1.2, 1.2];

// Stand (keys the shoulder's scale), Walk (keys nothing), Run (keys its own scale), a pose with no duration
const ANIMATIONS = [
	{ id: 0, variationIndex: 0, duration: 1000 },
	{ id: 4, variationIndex: 0, duration: 800 },
	{ id: 5, variationIndex: 0, duration: 600 },
	{ id: 6, variationIndex: 0, duration: 0 }
];

const track = (per_anim) => ({
	interpolation: 1,
	timestamps: per_anim.map(keys => keys.map(k => k[0])),
	values: per_anim.map(keys => keys.map(k => k[1]))
});

const no_keys = () => track(ANIMATIONS.map(() => []));

// bone 0: root, never scaled; bone 1: a shoulder scaled in Stand only (and in Run by its own keys)
const make_bones = () => [
	{ boneID: -1, boneNameCRC: 0, parentBone: -1, pivot: [0, 0, 0], translation: no_keys(), rotation: no_keys(), scale: no_keys() },
	{
		boneID: -1, boneNameCRC: 0, parentBone: 0, pivot: [0, 1, 0],
		translation: no_keys(),
		rotation: no_keys(),
		scale: track([
			[[0, SHOULDER], [500, [0.9, 0.9, 0.9]]],
			[],
			[[0, OWN_SCALE], [600, OWN_SCALE]],
			[]
		])
	}
];

/**
 * Write the test model as .gltf or .glb and read back, per animation, the scale keys of every bone.
 * @param {string} format - 'gltf' or 'glb'
 * @returns {Array<Map<number, {times: number[], values: number[][]}>>} animation -> bone index -> keys
 */
async function export_scales(format = 'gltf') {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wowexport-gltf-bone-scale-'));
	const writer = new GLTFWriter(path.join(dir, 'model.gltf'), 'model');
	writer.setVerticesArray([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	writer.setNormalArray([0, 0, 1, 0, 0, 1, 0, 0, 1]);
	writer.addUVArray([0, 0, 1, 0, 0, 1]);
	writer.setBoneIndexArray([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
	writer.setBoneWeightArray([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]);
	writer.addMesh('mesh', [0, 1, 2], 'mat');
	writer.setBonesArray(make_bones());
	writer.setAnimations(ANIMATIONS);
	await writer.write(true, format);

	let root, bins;
	if (format === 'glb') {
		// 12-byte header, then a JSON chunk and a BIN chunk, each with an 8-byte chunk header
		const glb = fs.readFileSync(path.join(dir, 'model.glb'));
		const json_length = glb.readUInt32LE(12);
		root = JSON.parse(glb.toString('utf8', 20, 20 + json_length));
		bins = [glb.subarray(20 + json_length + 8)];
	} else {
		root = JSON.parse(fs.readFileSync(path.join(dir, 'model.gltf'), 'utf8'));
		bins = root.buffers.map(b => b.uri ? fs.readFileSync(path.join(dir, b.uri)) : null);
	}
	const read = (accessor_idx, width) => {
		const accessor = root.accessors[accessor_idx];
		const view = root.bufferViews[accessor.bufferView];
		const bin = bins[view.buffer];
		const out = [];
		for (let i = 0; i < accessor.count; i++) {
			const v = [];
			for (let c = 0; c < width; c++)
				v.push(bin.readFloatLE(view.byteOffset + accessor.byteOffset + (i * width + c) * 4));
			out.push(width === 1 ? v[0] : v);
		}
		return out;
	};

	const joints = root.skins[0].joints;
	fs.rmSync(dir, { recursive: true, force: true });
	return root.animations.map(anim => {
		const scales = new Map();
		for (const channel of anim.channels) {
			if (channel.target.path !== 'scale')
				continue;
			const sampler = anim.samplers[channel.sampler];
			scales.set(joints.indexOf(channel.target.node), {
				times: read(sampler.input, 1),
				values: read(sampler.output, 3),
				max: root.accessors[sampler.input].max[0]
			});
		}
		return scales;
	});
}

const close = (actual, expected) => {
	assert.equal(actual.length, expected.length);
	actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${actual} is not ${expected}`));
};

test('animations without scale keys keep Stand\'s first scale key in the glTF', async () => {
	const anims = await export_scales();
	assert.equal(anims.length, ANIMATIONS.length);

	const walk = anims[1].get(1);
	assert.ok(walk, 'Walk has a scale channel for the shoulder');
	for (const value of walk.values)
		close(value, SHOULDER);
	close(walk.times, [0, 0.8]);
	assert.equal(walk.max, 0.8);

	const pose = anims[3].get(1);
	assert.ok(pose, 'a pose with no duration has a scale channel for the shoulder');
	close(pose.values[0], SHOULDER);
	close(pose.times, [0]);
});

test('.glb exports keep Stand\'s scale too', async () => {
	const anims = await export_scales('glb');
	const walk = anims[1].get(1);
	assert.ok(walk, 'Walk has a scale channel for the shoulder');
	for (const value of walk.values)
		close(value, SHOULDER);
	close(anims[0].get(1).values[1], [0.9, 0.9, 0.9]);
});

test('Stand and animations with their own scale keys are written as before', async () => {
	const anims = await export_scales();

	const stand = anims[0].get(1);
	close(stand.times, [0, 0.5]);
	close(stand.values[0], SHOULDER);
	close(stand.values[1], [0.9, 0.9, 0.9]);

	const run = anims[2].get(1);
	for (const value of run.values)
		close(value, OWN_SCALE);
});

test('a bone Stand does not scale gets no scale channel', async () => {
	const anims = await export_scales();
	for (const anim of anims)
		assert.equal(anim.has(0), false);
});

test('get_bone_scale_track falls back to animation 0 only when it has keys', () => {
	const [root, shoulder] = make_bones();
	assert.equal(get_bone_scale_track(root.scale, 1, 800), null);
	assert.equal(get_bone_scale_track(shoulder.scale, 0, 1000).timestamps, shoulder.scale.timestamps[0]);
	assert.equal(get_bone_scale_track(shoulder.scale, 2, 600).values, shoulder.scale.values[2]);
	assert.deepEqual(get_bone_scale_track(shoulder.scale, 1, 800), { timestamps: [0, 800], values: [SHOULDER, SHOULDER] });
	assert.deepEqual(get_bone_scale_track(shoulder.scale, 3, 0), { timestamps: [0], values: [SHOULDER] });
	// a track shorter than the animation list (no entry for this animation at all)
	assert.deepEqual(get_bone_scale_track({ timestamps: [[0]], values: [[SHOULDER]] }, 2, 600), { timestamps: [0, 600], values: [SHOULDER, SHOULDER] });
});
