/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for exports reporting done before their files are written (wow-to-stl #228):
	FileWriter.close() used to end the stream without waiting, and the OBJ, MTL, JSON, CSV and SQL
	writers did not await it, so write() resolved while the last lines were still buffered. Every
	file here is read back the moment the write resolves and must already hold every line.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// the writers pull in the app's core, constants and generics, which need nw.js: stand in for the few parts they use
function stub(request, exports) {
	const file = require.resolve(request);
	const mod = new Module(file, module);
	mod.filename = file;
	mod.loaded = true;
	mod.exports = exports;
	require.cache[file] = mod;
}

stub('../src/js/generics', {
	fileExists: async file => fs.existsSync(file),
	createDirectory: async dir => fs.promises.mkdir(dir, { recursive: true })
});
stub('../src/js/constants', { VERSION: 'test' });
stub('../src/js/core', { view: { config: { enableAbsoluteMTLPaths: false } } });
stub('../src/js/db/FieldType', require('../src/js/db/FieldType'));

const FileWriter = require('../src/js/file-writer');
const OBJWriter = require('../src/js/3D/writers/OBJWriter');
const MTLWriter = require('../src/js/3D/writers/MTLWriter');
const JSONWriter = require('../src/js/3D/writers/JSONWriter');
const CSVWriter = require('../src/js/3D/writers/CSVWriter');

// enough lines to fill the stream's buffer many times over, so the tail is still queued when end() returns
const LINES = 10000;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wowexport-file-writer-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('FileWriter.close() resolves only once every line is on disk', async () => {
	const file = path.join(dir, 'lines.txt');
	const writer = new FileWriter(file);
	for (let i = 0; i < LINES; i++)
		await writer.writeLine('line ' + i);

	await writer.close();

	const lines = fs.readFileSync(file, 'utf8').split('\n');
	assert.equal(lines.length, LINES + 1); // the last line ends with a newline
	assert.equal(lines[LINES - 1], 'line ' + (LINES - 1));
});

test('FileWriter.close() twice returns the same finished promise', async () => {
	const writer = new FileWriter(path.join(dir, 'twice.txt'));
	await writer.writeLine('only line');
	const first = writer.close();
	assert.equal(writer.close(), first);
	await first;
	await writer.close();
});

test('a write error rejects close() for whoever awaits it, and nobody else crashes', async () => {
	const unhandled = [];
	const on_unhandled = e => unhandled.push(e);
	process.on('unhandledRejection', on_unhandled);

	try {
		// the parent folder does not exist, so opening the file fails
		const awaited = new FileWriter(path.join(dir, 'missing', 'awaited.txt'));
		await assert.rejects(awaited.close(), { code: 'ENOENT' });

		// the tabs close the last_export list without awaiting it; a failure there must not become an
		// unhandled rejection, which src/app.js turns into the crash screen
		const not_awaited = new FileWriter(path.join(dir, 'missing', 'not-awaited.txt'));
		not_awaited.close();
		await new Promise(resolve => setTimeout(resolve, 50));
		assert.deepEqual(unhandled, []);
	} finally {
		process.off('unhandledRejection', on_unhandled);
	}
});

test('a write error stops writeLine() instead of leaving it waiting forever', async () => {
	const writer = new FileWriter(path.join(dir, 'missing', 'lines.txt'));
	await assert.rejects(async () => {
		for (let i = 0; i < LINES; i++)
			await writer.writeLine('line ' + i);
	}, { code: 'ENOENT' });
	await assert.rejects(writer.close(), { code: 'ENOENT' });
});

test('an optional file (the last_export list) never fails the export', async () => {
	const writer = new FileWriter(path.join(dir, 'missing', 'last_export'), 'utf8', true);
	for (let i = 0; i < LINES; i++)
		await writer.writeLine('OBJ:/somewhere/' + i + '.obj');

	await writer.close();
});

test('OBJWriter.write() resolves only once the whole OBJ is on disk', async () => {
	const file = path.join(dir, 'model.obj');
	const obj = new OBJWriter(file);
	const verts = [];
	const normals = [];
	const faces = [];
	for (let i = 0; i < LINES; i++) {
		verts.push(i, i + 1, i + 2);
		normals.push(0, 0, 1);
	}
	for (let i = 0; i + 2 < LINES; i += 3)
		faces.push(i, i + 1, i + 2);

	obj.setVertArray(verts);
	obj.setNormalArray(normals);
	obj.addMesh('mesh', faces, 'material');
	await obj.write();

	const text = fs.readFileSync(file, 'utf8');
	assert.ok(text.endsWith('\n'));
	const face_lines = text.split('\n').filter(line => line.startsWith('f '));
	assert.equal(face_lines.length, faces.length / 3);
});

test('MTLWriter.write() resolves only once every material is on disk', async () => {
	const file = path.join(dir, 'model.mtl');
	const mtl = new MTLWriter(file);
	for (let i = 0; i < LINES; i++)
		mtl.addMaterial('mat' + i, 'tex' + i + '.png');

	await mtl.write();

	const lines = fs.readFileSync(file, 'utf8').split('\n');
	assert.equal(lines[lines.length - 2], 'map_Kd tex' + (LINES - 1) + '.png');
});

test('JSONWriter.write() resolves only once the whole sidecar is on disk', async () => {
	const file = path.join(dir, 'model.json');
	const json = new JSONWriter(file);
	json.addProperty('rows', Array.from({ length: LINES }, (_, i) => ({ index: i, name: 'row ' + i })));

	await json.write();

	const data = JSON.parse(fs.readFileSync(file, 'utf8'));
	assert.equal(data.rows.length, LINES);
});

test('CSVWriter.write() resolves only once every row is on disk', async () => {
	const file = path.join(dir, 'table.csv');
	const csv = new CSVWriter(file);
	csv.addField('ID', 'Name');
	for (let i = 0; i < LINES; i++)
		csv.addRow({ ID: i, Name: 'row ' + i });

	await csv.write();

	const lines = fs.readFileSync(file, 'utf8').split('\n');
	assert.equal(lines.length, LINES + 2); // header, rows, trailing newline
	assert.equal(lines[LINES], (LINES - 1) + ';row ' + (LINES - 1));
});
