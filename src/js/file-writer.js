/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
 */
const fs = require('fs');

class FileWriter {
	/**
	 * Construct a new FileWriter instance.
	 * @param {string} file 
	 * @param {string} encoding 
	 * @param {boolean} [optional] - a file nothing depends on (the last_export list): write errors are
	 *   dropped instead of failing writeLine() and close()
	 */
	constructor(file, encoding = 'utf8', optional = false) {
		try {
			this.stream = fs.createWriteStream(file, { flags: 'w', encoding });
		} catch (e) {
			if (e.code === 'EISDIR') {
				fs.rmSync(file, { recursive: true });
				this.stream = fs.createWriteStream(file, { flags: 'w', encoding });
			} else {
				throw e;
			}
		}

		this.blocked = false;
		this.resolver = null;
		this.optional = optional;
		this.error = null;
		this.closing = null;

		// keep the first error for writeLine() and close(): an 'error' event with no listener
		// would be thrown as an uncaught exception
		this.stream.on('error', e => {
			this.error ??= e;
			this._drain();
		});
	}

	/**
	 * Write a line to the file.
	 * @param {string} line 
	 */
	async writeLine(line) {	
		if (this.blocked)
			await new Promise(resolve => this.resolver = resolve);

		if (this.error) {
			if (this.optional)
				return;

			throw this.error;
		}

		const result = this.stream.write(line + '\n');
		if (!result) {
			this.blocked = true;
			this.stream.once('drain', () => this._drain());
		}
	}

	_drain() {
		this.blocked = false;
		this.resolver?.();
	}

	/**
	 * Close the file. The promise resolves once every line is on disk and the file is
	 * closed, and rejects if the file could not be written. Exporters must await it
	 * before reporting the export done (wow-to-stl #228).
	 * @returns {Promise<void>}
	 */
	close() {
		if (!this.closing) {
			this.closing = new Promise((resolve, reject) => {
				const done = () => this.error && !this.optional ? reject(this.error) : resolve();
				if (this.stream.closed)
					return done();

				this.stream.once('close', done);
				this.stream.end();
			});

			// callers that do not await close() must not turn a write error into an
			// unhandled rejection (the crash screen, see src/app.js)
			this.closing.catch(() => {});
		}

		return this.closing;
	}
}

module.exports = FileWriter;