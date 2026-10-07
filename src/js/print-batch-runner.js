/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Runs the unattended print batch (F12) when the app is started with a print flag
	(src/js/wow/print-batch.js): open the last local installation, open the Characters tab,
	run the batch, write character/print-batch.json and quit. Every way out, a failure
	included, writes the result file before quitting, so whoever launched the app can wait
	for that file instead of watching the window.
*/

const path = require('path');
const fsp = require('fs').promises;
const log = require('./log');
const generics = require('./generics');
const InstallType = require('./install-type');
const ExportHelper = require('./casc/export-helper');
const print_batch = require('./wow/print-batch');

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000; // a cold CASC load with a fresh listfile can take minutes
const TAB_TIMEOUT_MS = 10 * 60 * 1000;

function wait_for(test, timeout_ms) {
	return new Promise(resolve => {
		const started = Date.now();
		const poll = () => {
			if (test())
				return resolve(true);

			if (Date.now() - started >= timeout_ms)
				return resolve(false);

			setTimeout(poll, 250);
		};
		poll();
	});
}

async function write_result(result) {
	const result_path = ExportHelper.getExportPath('character/' + print_batch.RESULT_FILE);
	try {
		await generics.createDirectory(path.dirname(result_path));
		await fsp.writeFile(result_path, JSON.stringify(result, null, '\t'));
		log.write('Print batch: result written to %s', result_path);
	} catch (e) {
		log.write('Print batch: failed to write %s: %s', result_path, e.message);
	}
}

async function quit() {
	log.write('Print batch: quitting');
	// give the runtime log a moment to flush before the process goes
	await new Promise(resolve => setTimeout(resolve, 1000));
	nw.App.quit();
}

/**
 * @param {object} core
 * @param {object} modules
 * @param {{all: boolean, names: string[], imports: object[], errors: string[]}} batch
 */
async function run(core, modules, batch) {
	const started = new Date().toISOString();
	const fail = async (message) => {
		log.write('Print batch: %s', message);
		await write_result({ ok: false, started, finished: new Date().toISOString(), exportDir: ExportHelper.getExportPath(''), errors: [...batch.errors, message], characters: [] });
		await quit();
	};

	log.write('Print batch requested at start-up: %s', JSON.stringify(batch));

	try {
		// a launcher waits for this file: never let it find the last run's
		await fsp.rm(ExportHelper.getExportPath('character/' + print_batch.RESULT_FILE), { force: true });

		const recent = core.view.config.recentLocal?.[0];
		if (!recent)
			return fail('no local installation has been opened in wow.export yet; open one by hand once');

		log.write('Print batch: opening %s (%s)', recent.path, recent.product);
		core.view.printBatchInstall = recent;
		core.events.emit('print-batch-open-install');

		if (!await wait_for(() => core.view.installType === InstallType.CASC, INSTALL_TIMEOUT_MS))
			return fail('the local installation did not load: ' + recent.path);

		const tab = modules.tab_characters;
		tab.setActive();
		if (!await wait_for(() => tab.is_ready(), TAB_TIMEOUT_MS))
			return fail('the Characters tab did not finish loading');

		const result = await tab.run_print_batch(core, batch);
		log.write('Print batch: %s', result.ok ? 'all exported' : 'finished with failures');
		await quit();
	} catch (e) {
		log.write('Print batch: %s', e.stack || e.message);
		await fail('unexpected error: ' + e.message);
	}
}

module.exports = { run };
