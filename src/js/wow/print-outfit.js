/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Outfit files (#107, Kara 2026-10-09): one list of items put on a fresh default character of
	every playable race and body type, so the test exports for WoW Print all wear the same gear
	and no character is set up by hand. A file looks like this:

	  {
	    "name": "standard",
	    "items": { "Shoulder": 16953, "Chest": 16958, "Main-hand": 128870, "Off-hand": 1168 },
	    "passes": { "cloak": { "Back": 253340 }, "backpack": { "Back": 174361 } },
	    "skipRaces": ["Dracthyr"]
	  }

	`items` is worn in every pass; each pass adds or replaces slots (the game lets a character
	wear a cloak or a backpack, never both). A file with no passes has one, named "outfit". An
	item is its id, or { "item": <id>, "skin": <ItemAppearanceModifierID> }; a slot set to null
	is left empty in that pass. "Shoulder" fills both shoulders. `races` limits the run to the
	races named, `skipRaces` leaves races out; a race is its ChrRaces id or its name in any case.

	The start-up flag --print-outfit=<file> exports each pass of each race and body type to
	character/outfit/<name>/<pass>/<race>-<male|female>; the Characters tab's Wear Outfit File
	puts a pass on the character on screen, so the outfit can be looked at before any export.
*/

const { SHOULDER_SLOT_L, SHOULDER_SLOT_R } = require('./EquipmentSlots');

const DEFAULT_PASS = 'outfit';

// a slot named in an outfit file -> the slot ids it fills (names as the equipment list shows them)
const SLOT_NAMES = {
	'head': [1],
	'neck': [2],
	'shoulder': [SHOULDER_SLOT_L, SHOULDER_SLOT_R],
	'shoulders': [SHOULDER_SLOT_L, SHOULDER_SLOT_R],
	'shoulder (l)': [SHOULDER_SLOT_L],
	'shoulder (r)': [SHOULDER_SLOT_R],
	'back': [15],
	'chest': [5],
	'shirt': [4],
	'tabard': [19],
	'wrist': [9],
	'hands': [10],
	'waist': [6],
	'legs': [7],
	'feet': [8],
	'main-hand': [16],
	'off-hand': [17]
};

const VALID_SLOT_IDS = new Set(Object.values(SLOT_NAMES).flat());

/**
 * The slot ids a key of an outfit file fills: a slot name in any case ("Main-hand", "main hand",
 * "Shoulder (L)"), or a slot id ("16").
 * @param {string} key
 * @returns {number[]|null}
 */
function slot_ids_for_key(key) {
	const text = String(key).trim().toLowerCase();
	if (/^\d+$/.test(text)) {
		const id = parseInt(text, 10);
		return VALID_SLOT_IDS.has(id) ? [id] : null;
	}

	const name = text.replace(/\s+/g, ' ').replace(/^(main|off) ?hand$/, '$1-hand');
	return SLOT_NAMES[name] ?? null;
}

/**
 * One slot list of an outfit file as { slot id: { item, skin } }, null for a slot left empty.
 * @param {object} list
 * @param {string} where - for the error messages
 * @param {string[]} errors - collects what could not be read
 * @returns {Object<number, ?{item: number, skin: ?number}>}
 */
function read_slots(list, where, errors) {
	const slots = {};
	if (list === undefined || list === null)
		return slots;

	if (typeof list !== 'object' || Array.isArray(list)) {
		errors.push(where + ': expected an object of slot: item');
		return slots;
	}

	for (const [key, value] of Object.entries(list)) {
		const slot_ids = slot_ids_for_key(key);
		if (slot_ids === null) {
			errors.push(where + ': unknown slot "' + key + '"');
			continue;
		}

		let entry = null;
		if (value === null) {
			entry = null;
		} else if (Number.isInteger(value) && value > 0) {
			entry = { item: value, skin: null };
		} else if (typeof value === 'object' && Number.isInteger(value.item) && value.item > 0) {
			const skin = value.skin ?? null;
			if (skin !== null && !(Number.isInteger(skin) && skin >= 0)) {
				errors.push(where + ': "' + key + '" has a skin that is not a whole number');
				continue;
			}
			entry = { item: value.item, skin };
		} else {
			errors.push(where + ': "' + key + '" is not an item id');
			continue;
		}

		for (const slot_id of slot_ids)
			slots[slot_id] = entry;
	}

	return slots;
}

function read_race_list(list, where, errors) {
	if (list === undefined || list === null)
		return [];

	if (!Array.isArray(list) || list.some(r => !(Number.isInteger(r) || (typeof r === 'string' && r.trim().length > 0)))) {
		errors.push(where + ': expected a list of race ids or names');
		return [];
	}

	return list.map(r => typeof r === 'string' ? r.trim() : r);
}

/**
 * Read an outfit file.
 * @param {string|object} source - the file's text, or its parsed JSON
 * @param {string} [fallback_name] - the name when the file has none (its file name)
 * @returns {{name: string, items: object, passes: {name: string, slots: object}[], races: Array, skipRaces: Array, errors: string[]}}
 */
function parse_outfit(source, fallback_name = DEFAULT_PASS) {
	const errors = [];
	let data = source;
	if (typeof source === 'string') {
		try {
			data = JSON.parse(source);
		} catch (e) {
			return { name: fallback_name, items: {}, passes: [], races: [], skipRaces: [], errors: ['not valid JSON: ' + e.message] };
		}
	}

	if (data === null || typeof data !== 'object' || Array.isArray(data))
		return { name: fallback_name, items: {}, passes: [], races: [], skipRaces: [], errors: ['expected a JSON object'] };

	const name = folder_part(typeof data.name === 'string' ? data.name : '') || folder_part(fallback_name) || DEFAULT_PASS;
	const items = read_slots(data.items, 'items', errors);

	const passes = [];
	if (data.passes !== undefined && data.passes !== null) {
		if (typeof data.passes !== 'object' || Array.isArray(data.passes)) {
			errors.push('passes: expected an object of pass name: slots');
		} else {
			for (const [pass_name, pass_slots] of Object.entries(data.passes)) {
				const clean = folder_part(pass_name);
				if (!clean) {
					errors.push('passes: a pass needs a name');
					continue;
				}
				if (passes.some(p => p.name === clean)) {
					errors.push('passes: "' + pass_name + '" is named twice');
					continue;
				}
				passes.push({ name: clean, slots: read_slots(pass_slots, 'passes.' + pass_name, errors) });
			}
		}
	}

	if (passes.length === 0)
		passes.push({ name: DEFAULT_PASS, slots: {} });

	return {
		name,
		items,
		passes,
		races: read_race_list(data.races, 'races', errors),
		skipRaces: read_race_list(data.skipRaces, 'skipRaces', errors),
		errors
	};
}

/**
 * What a pass wears: the outfit's items with the pass's slots on top, as the Characters tab
 * keeps them (chrEquippedItems and chrEquippedItemSkins).
 * @param {object} outfit - from parse_outfit
 * @param {string} [pass_name] - the first pass when not given
 * @returns {{equipment: Object<number, number>, skins: Object<number, number>}|null} null for an unknown pass
 */
function pass_equipment(outfit, pass_name) {
	const pass = pass_name === undefined ? outfit.passes[0] : outfit.passes.find(p => p.name === pass_name);
	if (!pass)
		return null;

	const merged = { ...outfit.items, ...pass.slots };
	const equipment = {};
	const skins = {};
	for (const [slot_id, entry] of Object.entries(merged)) {
		if (entry === null)
			continue;

		equipment[slot_id] = entry.item;
		if (entry.skin !== null)
			skins[slot_id] = entry.skin;
	}

	return { equipment, skins };
}

/**
 * Every item id the outfit names, in any pass.
 * @param {object} outfit
 * @returns {number[]}
 */
function outfit_item_ids(outfit) {
	const ids = new Set();
	for (const slots of [outfit.items, ...outfit.passes.map(p => p.slots)]) {
		for (const entry of Object.values(slots)) {
			if (entry !== null)
				ids.add(entry.item);
		}
	}
	return [...ids];
}

/**
 * Check every item against the game's item list: unknown ids are errors, an item in a slot its
 * kind doesn't go in is a warning (a one-hand weapon may go in either hand).
 * @param {object} outfit
 * @param {function(number): ?number} slot_of_item - DBItems.getItemSlotId
 * @returns {{errors: string[], warnings: string[]}}
 */
function check_items(outfit, slot_of_item) {
	const errors = [];
	const warnings = [];
	const seen = new Set();
	for (const slots of [outfit.items, ...outfit.passes.map(p => p.slots)]) {
		for (const [slot_key, entry] of Object.entries(slots)) {
			if (entry === null)
				continue;

			const slot_id = Number(slot_key);
			const key = entry.item + ':' + slot_id;
			if (seen.has(key))
				continue;
			seen.add(key);

			const item_slot = slot_of_item(entry.item);
			if (item_slot === null || item_slot === undefined) {
				if (!errors.some(e => e.startsWith('item ' + entry.item + ' ')))
					errors.push('item ' + entry.item + ' is not in this game build');
				continue;
			}

			const fits = item_slot === slot_id
				|| (item_slot === SHOULDER_SLOT_L && slot_id === SHOULDER_SLOT_R)
				|| (item_slot === 16 && slot_id === 17);
			if (!fits)
				warnings.push('item ' + entry.item + ' is worn in slot ' + slot_id + ' but goes in slot ' + item_slot);
		}
	}
	return { errors, warnings };
}

// letters, digits and - only: race labels and pass names become folder names
function folder_part(text) {
	return String(text || '').trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function race_matches(race, entry) {
	if (typeof entry === 'number')
		return race.id === entry;

	return folder_part(race.label) === folder_part(entry);
}

/**
 * The races an outfit is worn by: the playable races the Characters tab lists, limited by
 * `races` and without `skipRaces`. Entries that match no race are reported.
 * @param {{id: number, label: string}[]} playable - chrCustRacesPlayable
 * @param {object} outfit
 * @returns {{races: {id: number, label: string}[], unknown: Array}}
 */
function select_races(playable, outfit) {
	const list = playable || [];
	const unknown = [...outfit.races, ...outfit.skipRaces].filter(entry => !list.some(race => race_matches(race, entry)));
	const races = list.filter(race =>
		(outfit.races.length === 0 || outfit.races.some(entry => race_matches(race, entry)))
		&& !outfit.skipRaces.some(entry => race_matches(race, entry)));
	return { races, unknown };
}

/** "male" for ChrModel sex 0, "female" for 1, "type-<n>" past that. */
function sex_label(sex) {
	return sex === 0 ? 'male' : sex === 1 ? 'female' : 'type-' + (Number(sex) + 1);
}

/**
 * The folder one export of an outfit goes to: character/outfit/<outfit>/<pass>/<race>-<sex>.
 * @param {string} outfit_name
 * @param {string} pass_name
 * @param {string} race_label - "Blood Elf"
 * @param {number} sex - ChrModel sex (0 male, 1 female)
 * @returns {string}
 */
function outfit_folder(outfit_name, pass_name, race_label, sex) {
	return 'character/outfit/' + (folder_part(outfit_name) || DEFAULT_PASS) + '/' + (folder_part(pass_name) || DEFAULT_PASS) + '/' + (folder_part(race_label) || 'race') + '-' + sex_label(sex);
}

/**
 * Every export an outfit asks for, pass by pass, then race by race, then body type.
 * @param {object} outfit
 * @param {{id: number, label: string}[]} races - from select_races
 * @param {function(number): ?Map<number, number>} race_models - DBCharacterCustomization.get_race_models (sex -> ChrModel id)
 * @returns {{pass: string, race: {id: number, label: string}, sex: number, chrModelID: number, label: string, folder: string}[]}
 */
function outfit_jobs(outfit, races, race_models) {
	const jobs = [];
	for (const pass of outfit.passes) {
		const used = new Set();
		for (const race of races) {
			const models = race_models(race.id);
			if (!models)
				continue;

			for (const [sex, chr_model_id] of [...models.entries()].sort((a, b) => a[0] - b[0])) {
				// two races with one name (a visage form) get their race id in the folder
				let folder = outfit_folder(outfit.name, pass.name, race.label, sex);
				if (used.has(folder))
					folder = outfit_folder(outfit.name, pass.name, race.label + ' ' + race.id, sex);
				used.add(folder);

				jobs.push({
					pass: pass.name,
					race,
					sex,
					chrModelID: chr_model_id,
					label: outfit.name + '/' + pass.name + ': ' + race.label + ' ' + sex_label(sex),
					folder
				});
			}
		}
	}
	return jobs;
}

module.exports = { DEFAULT_PASS, slot_ids_for_key, parse_outfit, pass_equipment, outfit_item_ids, check_items, select_races, sex_label, outfit_folder, outfit_jobs, folder_part };
