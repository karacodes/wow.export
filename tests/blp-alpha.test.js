/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for striped texture layers (wow-to-stl #254, Kara 2026-10-12: the
	lower sleeve and lower glove layer PNGs show every other column transparent): a
	palettized BLP with 4-bit alpha holds two alphas per byte, low nibble first, and each
	must decode to its own pixel scaled to 0-255. Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

// blp.js and buffer.js load webp-wasm for WebP export, which these tests never use
const resolve_filename = Module._resolveFilename;
Module._resolveFilename = function(request, ...rest) {
	if (request === 'webp-wasm')
		return request;
	return resolve_filename.call(this, request, ...rest);
};
require.cache['webp-wasm'] = { id: 'webp-wasm', filename: 'webp-wasm', loaded: true, exports: {} };

const BufferWrapper = require(path.join(__dirname, '..', 'src', 'js', 'buffer.js'));
const PNGWriter = require(path.join(__dirname, '..', 'src', 'js', 'png-writer.js'));
const BLPImage = require(path.join(__dirname, '..', 'src', 'js', 'casc', 'blp.js'));

const HEADER_SIZE = 4 + 4 + 4 + 4 + 4 + 16 * 4 + 16 * 4;
const PALETTE_SIZE = 256 * 4;

/**
 * Build a one-mipmap palettized BLP2 (encoding 1). Pixel i uses palette entry i,
 * whose BGRA colour is (i, 100 + i, 200 + i, 0).
 * @param {number} width
 * @param {number} height
 * @param {number} alpha_depth
 * @param {number[]} alpha_bytes
 */
const make_blp = (width, height, alpha_depth, alpha_bytes) => {
	const length = width * height;
	const map_size = length + alpha_bytes.length;
	const buf = Buffer.alloc(HEADER_SIZE + PALETTE_SIZE + map_size);

	let ofs = 0;
	buf.writeUInt32LE(0x32504c42, ofs); ofs += 4; // BLP2
	buf.writeUInt32LE(1, ofs); ofs += 4; // type
	buf.writeUInt8(1, ofs++); // encoding: palettized
	buf.writeUInt8(alpha_depth, ofs++);
	buf.writeUInt8(0, ofs++); // alpha encoding
	buf.writeUInt8(0, ofs++); // no mipmaps
	buf.writeUInt32LE(width, ofs); ofs += 4;
	buf.writeUInt32LE(height, ofs); ofs += 4;
	buf.writeUInt32LE(HEADER_SIZE + PALETTE_SIZE, ofs); // first map offset, the rest 0
	buf.writeUInt32LE(map_size, ofs + 16 * 4); // first map size

	ofs = HEADER_SIZE;
	for (let i = 0; i < 256; i++) {
		buf.writeUInt8(i & 0xFF, ofs++);
		buf.writeUInt8((100 + i) & 0xFF, ofs++);
		buf.writeUInt8((200 + i) & 0xFF, ofs++);
		buf.writeUInt8(0, ofs++);
	}

	for (let i = 0; i < length; i++)
		buf.writeUInt8(i, ofs++);

	for (const byte of alpha_bytes)
		buf.writeUInt8(byte, ofs++);

	return new BLPImage(new BufferWrapper(buf));
};

const decoded_alpha = (blp) => {
	const rgba = blp.toUInt8Array(0, 0b1111);
	const alpha = [];
	for (let i = 3; i < rgba.length; i += 4)
		alpha.push(rgba[i]);
	return alpha;
};

test('4-bit alpha: each pixel gets its own nibble, low nibble first, scaled to 0-255', () => {
	// 8x2 = 16 pixels: alphas 0..15 in order, two per byte
	const nibbles = Array.from({ length: 16 }, (_, i) => i);
	const bytes = [];
	for (let i = 0; i < nibbles.length; i += 2)
		bytes.push(nibbles[i] | (nibbles[i + 1] << 4));

	const blp = make_blp(8, 2, 4, bytes);
	assert.deepEqual(decoded_alpha(blp), nibbles.map(n => n * 17));
});

test('4-bit alpha: a fully opaque layer has no clear columns', () => {
	const blp = make_blp(6, 3, 4, new Array(9).fill(0xFF));
	assert.deepEqual(decoded_alpha(blp), new Array(18).fill(255));
});

test('4-bit alpha: odd pixel count reads the last low nibble', () => {
	const blp = make_blp(3, 1, 4, [0x5A, 0x07]);
	assert.deepEqual(decoded_alpha(blp), [0xA * 17, 0x5 * 17, 0x7 * 17]);
});

test('4-bit alpha: the PNG writer (layers/ PNGs) gets the same alpha', () => {
	// read the pixels toPNG hands the PNG writer instead of the compressed file
	const get_buffer = PNGWriter.prototype.getBuffer;
	PNGWriter.prototype.getBuffer = function() {
		return this.getPixelData();
	};

	let pixels;
	try {
		pixels = make_blp(4, 1, 4, [0xF0, 0x3C]).toPNG(0b1111);
	} finally {
		PNGWriter.prototype.getBuffer = get_buffer;
	}

	const alpha = [];
	for (let i = 3; i < pixels.length; i += 4)
		alpha.push(pixels[i]);

	assert.deepEqual(alpha, [0, 255, 0xC * 17, 0x3 * 17]);
});

test('palettized colour comes out as RGB from the BGRA palette', () => {
	const blp = make_blp(2, 1, 8, [10, 20]);
	const rgba = Array.from(blp.toUInt8Array(0, 0b1111));
	assert.deepEqual(rgba, [200, 100, 0, 10, 201, 101, 1, 20]);
});

test('1-bit alpha: one bit per pixel, lowest bit first', () => {
	// 10 pixels: bits 1,0,1,1,0,0,0,1 | 0,1
	const blp = make_blp(10, 1, 1, [0b10001101, 0b10]);
	assert.deepEqual(decoded_alpha(blp), [255, 0, 255, 255, 0, 0, 0, 255, 0, 255]);
});

test('8-bit alpha: one byte per pixel', () => {
	const blp = make_blp(3, 1, 8, [0, 128, 255]);
	assert.deepEqual(decoded_alpha(blp), [0, 128, 255]);
});

test('no alpha: every pixel is opaque', () => {
	const blp = make_blp(3, 1, 0, []);
	assert.deepEqual(decoded_alpha(blp), [255, 255, 255]);
});
