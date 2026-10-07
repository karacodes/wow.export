/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Unattended print exports (F12, Kara 2026-10-07): the start-up flags that make the app
	export characters for WoW Print on its own and quit, so an agent on the Mac can run it.

	  --print-export-all                      every saved character (the default set)
	  --print-export=<name>                   one saved character by name; repeat for more
	  --print-import=<region>/<realm>/<name>  import a character from the armory first; repeat

	With only --print-import, the run exports the imported characters; with no flag at all the
	app starts as usual. Each character goes to character/<realm>/<name>/ under the export
	folder, `local` when it has no realm (built by hand), and the run writes
	character/print-batch.json before it quits.
*/

const LOCAL_REALM = 'local';
const RESULT_FILE = 'print-batch.json';

const FLAG_ALL = '--print-export-all';
const FLAG_EXPORT = '--print-export=';
const FLAG_IMPORT = '--print-import=';

/**
 * The batch the start-up arguments ask for, or null for a normal start.
 * @param {string[]} argv - nw.App.argv
 * @returns {{all: boolean, names: string[], imports: {region: string, realm: string, name: string}[], errors: string[]}|null}
 */
function parse_print_batch_args(argv) {
	let all = false;
	let any = false;
	const names = [];
	const imports = [];
	const errors = [];

	for (const arg of argv || []) {
		if (typeof arg !== 'string')
			continue;

		if (arg === FLAG_ALL) {
			all = true;
			any = true;
		} else if (arg.startsWith(FLAG_EXPORT)) {
			any = true;
			const name = arg.slice(FLAG_EXPORT.length).trim();
			if (name.length === 0)
				errors.push('empty name in ' + arg);
			else if (!names.some(n => n.toLowerCase() === name.toLowerCase()))
				names.push(name);
		} else if (arg.startsWith(FLAG_IMPORT)) {
			any = true;
			const parts = arg.slice(FLAG_IMPORT.length).split('/').map(p => p.trim());
			if (parts.length !== 3 || parts.some(p => p.length === 0))
				errors.push('expected <region>/<realm>/<name> in ' + arg);
			else
				imports.push({ region: parts[0].toLowerCase(), realm: realm_slug(parts[1]), name: parts[2] });
		}
	}

	if (!any)
		return null;

	// nothing named: the whole saved collection, as the Export All button does
	if (names.length === 0 && imports.length === 0)
		all = true;

	return { all, names, imports, errors };
}

/**
 * A realm as the armory's slug: "Argent Dawn" -> "argent-dawn", "Kel'Thuzad" -> "kelthuzad".
 * @param {string} realm
 * @returns {string}
 */
function realm_slug(realm) {
	return String(realm || '').trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-');
}

// the characters Windows and macOS refuse in a file name (ExportHelper.sanitizeFilename)
function safe_folder_name(str) {
	return String(str || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

/**
 * The folder, under the export folder, a batch export of one character goes to:
 * character/<realm>/<name>, with `local` for a character that has no realm.
 * @param {string|null} realm - the realm slug, or null
 * @param {string} name - the character's name
 * @param {string} [fallback] - used when the name has nothing left after cleaning (the save id)
 * @returns {string} a relative path with forward slashes
 */
function character_folder(realm, name, fallback = 'unnamed') {
	const realm_dir = safe_folder_name(realm_slug(realm)) || LOCAL_REALM;
	const name_dir = safe_folder_name(name) || safe_folder_name(fallback) || 'unnamed';
	return 'character/' + realm_dir + '/' + name_dir;
}

/**
 * The saved characters a batch exports: all of them, or the named ones (any case).
 * @param {{name: string}[]} saved
 * @param {{all: boolean, names: string[]}} batch
 * @returns {{selected: object[], missing: string[]}}
 */
function select_saved(saved, batch) {
	const list = saved || [];
	if (batch.all)
		return { selected: [...list], missing: [] };

	const selected = [];
	const missing = [];
	for (const name of batch.names) {
		const lower = name.toLowerCase();
		const matches = list.filter(c => String(c.name).toLowerCase() === lower);
		if (matches.length === 0)
			missing.push(name);
		else
			selected.push(...matches.filter(c => !selected.includes(c)));
	}

	return { selected, missing };
}

module.exports = { LOCAL_REALM, RESULT_FILE, parse_print_batch_args, realm_slug, character_folder, select_saved };
