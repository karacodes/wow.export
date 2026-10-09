/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Unattended print exports (F12, Kara 2026-10-07): the start-up flags that make the app
	export characters for WoW Print on its own and quit, so an agent on the Mac can run it.

	  --print-export-all                      every saved character (the default set)
	  --print-export=<name>                   one saved character by name; repeat for more
	  --print-import=<region>/<realm>/<name>  import a character from the armory first; repeat
	  --print-outfit=<file>                   every race and body type wearing an outfit file
	                                          (src/js/wow/print-outfit.js, #107); repeat

	With only --print-import or --print-outfit, the run exports just those; with no flag at all the
	app starts as usual. A malformed name or import flag is reported in the result and exports
	nothing in its place (never every saved character). Each character goes to character/<realm>/<name>/ under the export
	folder, `local` when it has no realm (built by hand), an outfit's to character/outfit/..., and the run writes
	character/print-batch.json before it quits.
*/

const LOCAL_REALM = 'local';
const RESULT_FILE = 'print-batch.json';

const FLAG_ALL = '--print-export-all';
const FLAG_EXPORT = '--print-export=';
const FLAG_IMPORT = '--print-import=';
const FLAG_OUTFIT = '--print-outfit=';

/**
 * The batch the start-up arguments ask for, or null for a normal start.
 * @param {string[]} argv - nw.App.argv
 * @returns {{all: boolean, names: string[], imports: {region: string, realm: string, name: string}[], outfits: string[], errors: string[]}|null}
 */
function parse_print_batch_args(argv) {
	let all = false;
	let any = false;
	let named_any = false; // a --print-export, --print-import or --print-outfit flag, usable or not
	const names = [];
	const imports = [];
	const outfits = [];
	const errors = [];

	for (const arg of argv || []) {
		if (typeof arg !== 'string')
			continue;

		if (arg === FLAG_ALL) {
			all = true;
			any = true;
		} else if (arg.startsWith(FLAG_EXPORT)) {
			any = true;
			named_any = true;
			const name = arg.slice(FLAG_EXPORT.length).trim();
			if (name.length === 0)
				errors.push('empty name in ' + arg);
			else if (!names.some(n => n.toLowerCase() === name.toLowerCase()))
				names.push(name);
		} else if (arg.startsWith(FLAG_IMPORT)) {
			any = true;
			named_any = true;
			const parts = arg.slice(FLAG_IMPORT.length).split('/').map(p => p.trim());
			if (parts.length !== 3 || parts.some(p => p.length === 0))
				errors.push('expected <region>/<realm>/<name> in ' + arg);
			else
				imports.push({ region: parts[0].toLowerCase(), realm: realm_slug(parts[1]), name: parts[2] });
		} else if (arg.startsWith(FLAG_OUTFIT)) {
			any = true;
			named_any = true;
			const file = arg.slice(FLAG_OUTFIT.length).trim();
			if (file.length === 0)
				errors.push('empty file in ' + arg);
			else if (!outfits.includes(file))
				outfits.push(file);
		}
	}

	if (!any)
		return null;

	// no character named at all: the whole saved collection, as the Export All button does. A
	// named flag that was rejected never widens the run to every character; it is reported.
	if (!named_any)
		all = true;

	return { all, names, imports, outfits, errors };
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
 * Where a single Export for printing writes (F14, Kara 2026-10-08: "Realm/name folder"): a
 * character with a name (imported from the armory, or saved) goes to character/<realm>/<name>
 * like the batch, `local` when it has no realm; one built by hand keeps the model's own folder
 * (null here).
 * @param {?string} name - the character's name (saved, else armory)
 * @param {?string} realm - the realm slug, or null
 * @returns {?string}
 */
function print_export_folder(name, realm) {
	if (typeof name !== 'string' || name.trim().length === 0)
		return null;

	return character_folder(realm, name.trim());
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

module.exports = { LOCAL_REALM, RESULT_FILE, parse_print_batch_args, realm_slug, character_folder, print_export_folder, select_saved };
