/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for map exports reporting done before their raw files are written (wow-to-stl #260):
	in RAW map format the first tile of a map writes the WDT and its companion files (_lgt, _occ, _fogs and
	_mpv WDTs, .tex, .wdl, .pd4), and all but the WDT were written without `await`, so ADTExporter.export()
	resolved, and the Maps tab said done, while they were still being written. Here every CASC file takes a
	while to write, and every file must be on disk the moment export() resolves.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// the WDT's companion files (a large .wdl or .tex) take longer to write than the whole rest of the tile, so a
// write export() does not await is still pending when it resolves
const COMPANION_WRITE_MS = 300;
const TILE_WRITE_MS = 10;

const MAP_DIR = 'testmap';
const TILE_INDEX = 32 * 64 + 31; // tile 32_31

// fileDataIDs for the WDT's companion files; the names are what the exporter writes them as
const COMPANIONS = {
	lgtFileDataID: [101, MAP_DIR + '_lgt.wdt'],
	occFileDataID: [102, MAP_DIR + '_occ.wdt'],
	fogsFileDataID: [103, MAP_DIR + '_fogs.wdt'],
	mpvFileDataID: [104, MAP_DIR + '_mpv.wdt'],
	texFileDataID: [105, MAP_DIR + '.tex'],
	wdlFileDataID: [106, MAP_DIR + '.wdl'],
	pd4FileDataID: [107, MAP_DIR + '.pd4']
};

const pending_writes = new Set();

const companion_ids = new Set(Object.values(COMPANIONS).map(([id]) => id));

// a CASC file whose write lands on disk only after a delay, like a large file on a slow disk
const slow_file = (id) => ({
	id,
	writeToFile: (file) => {
		const delay = companion_ids.has(id) ? COMPANION_WRITE_MS : TILE_WRITE_MS;
		const write = new Promise(resolve => setTimeout(resolve, delay))
			.then(() => fs.promises.mkdir(path.dirname(file), { recursive: true }))
			.then(() => fs.promises.writeFile(file, 'file ' + id))
			.finally(() => pending_writes.delete(write));
		pending_writes.add(write);
		return write;
	}
});

const config = {
	exportMapFormat: 'RAW',
	pathFormat: 'posix',
	overwriteFiles: true,
	enableSharedTextures: false,
	mapsIncludeWMO: false,
	mapsIncludeM2: false,
	mapsIncludeGameObjects: false,
	mapsIncludeLiquid: false,
	mapsIncludeFoliage: false
};

class FakeWDTLoader {
	constructor(file) {
		this.file = file;
	}

	async load() {
		for (const [field, [id]] of Object.entries(COMPANIONS))
			this[field] = id;

		this.entries = [];
		this.entries[TILE_INDEX] = { rootADT: 201, tex0ADT: 202, obj0ADT: 203, obj1ADT: 204, lodADT: 0 };
	}
}

class FakeADTLoader {
	constructor(file) {
		this.file = file;
		this.diffuseTextureFileDataIDs = [];
		this.heightTextureFileDataIDs = [];
	}

	loadRoot() {}
	loadTex() {}
	loadObj() {}
}

// the exporter pulls in the app's core, CASC and GL code, which need nw.js: stand in for the parts it uses,
// and put the real modules back once it is loaded so other test files see them unchanged
const exporter_dir = path.join(__dirname, '../src/js/3D/exporters');
const stubs = {
	'../../core': { view: { casc: { getFile: async id => slow_file(id), getFileByName: async () => slow_file('wdt') }, config } },
	'../../constants': { GAME: { MAP_SIZE: 64, TILE_SIZE: (51200 / 3) / 32 } },
	'../../generics': { fileExists: async file => fs.existsSync(file) },
	'../../casc/listfile': { getByFilename: () => 0, getByID: () => undefined },
	'../../log': { write: () => {} },
	'../../buffer': {},
	'../../casc/blp': class {},
	'../loaders/WDTLoader': FakeWDTLoader,
	'../loaders/ADTLoader': FakeADTLoader,
	'../Shaders': {},
	'../writers/OBJWriter': class {},
	'../writers/MTLWriter': class {},
	'../../png-writer': class {},
	'../../casc/db2': {},
	'../../casc/export-helper': {},
	'../../3D/exporters/M2Exporter': class {},
	'../../3D/exporters/WMOExporter': class { static clearCache() {} },
	'../../3D/writers/CSVWriter': class {},
	'../../3D/writers/JSONWriter': class {}
};

function load_exporter() {
	const saved = new Map();
	const install = (file, exports) => {
		saved.set(file, require.cache[file]);
		const mod = new Module(file, module);
		mod.filename = file;
		mod.loaded = true;
		mod.exports = exports;
		require.cache[file] = mod;
	};

	for (const [request, exports] of Object.entries(stubs))
		install(require.resolve(path.join(exporter_dir, request)), exports);

	const exporter_file = require.resolve(path.join(exporter_dir, 'ADTExporter'));
	saved.set(exporter_file, require.cache[exporter_file]);
	delete require.cache[exporter_file];

	try {
		return require(exporter_file);
	} finally {
		for (const [file, previous] of saved) {
			if (previous)
				require.cache[file] = previous;
			else
				delete require.cache[file];
		}
	}
}

const ADTExporter = load_exporter();

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wowexport-adt-raw-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('a RAW map tile export resolves only once every raw file is on disk', async () => {
	ADTExporter.clearCache();
	const adt = new ADTExporter(1, MAP_DIR, TILE_INDEX);
	const out = await adt.export(dir, 0, undefined, undefined);

	const expected = [MAP_DIR + '.wdt', ...Object.values(COMPANIONS).map(([, name]) => name)];
	expected.push(...['.adt', '_tex0.adt', '_obj0.adt', '_obj1.adt'].map(suffix => MAP_DIR + '_' + adt.tileID + suffix));

	const missing = expected.filter(name => !fs.existsSync(path.join(dir, name)));
	assert.deepEqual(missing, [], 'export() resolved before these files were written');
	assert.equal(pending_writes.size, 0, 'writes were still in flight when export() resolved');
	assert.equal(out.type, 'ADT_RAW');

	ADTExporter.clearCache();
});
