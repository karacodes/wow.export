/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Randomize Equipment (F11): one click dresses the character in one random game
	item set (ItemSet). Only the armour slots are rolled (head, neck, shoulders,
	back, chest, wrist, hands, waist, legs, feet); weapons, shirt and tabard keep
	what they have, and so does an armour slot the set has no piece for. The
	shoulder piece goes on both shoulders. Only sets with at least four visible
	armour pieces (a model or a texture) take part, and an invisible piece is
	never put on. One appearance variant (normal, heroic, mythic...) is drawn per
	roll and worn by every piece that has it; a piece without it shows its first
	look (Kara's answers, 2026-10-07).

	Pure helpers: the game data comes in as functions so the tests need no CASC.
*/

const { SHOULDER_SLOT_L, SHOULDER_SLOT_R } = require('./EquipmentSlots');

// head, neck, shoulder, back, chest, wrist, hands, waist, legs, feet
const ARMOUR_SLOTS = [1, 2, SHOULDER_SLOT_L, 15, 5, 9, 10, 6, 7, 8];
const MIN_SET_PIECES = 4;

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/**
 * A set's visible armour pieces by slot. A set may list two items for one slot
 * (a robe and a chest): both are kept and one is drawn per roll.
 * @param {number[]} item_ids - the set's ItemSet.ItemID entries
 * @param {function(number): number|null} slot_of - item id -> equipment slot id
 * @param {function(number): boolean} is_visible - item id -> has a model or a texture
 * @returns {Map<number, number[]>} slot id -> item ids
 */
function armour_pieces(item_ids, slot_of, is_visible) {
	const pieces = new Map();
	for (const item_id of item_ids) {
		if (!item_id || !is_visible(item_id))
			continue;

		const slot_id = slot_of(item_id);
		if (!ARMOUR_SLOTS.includes(slot_id))
			continue;

		if (!pieces.has(slot_id))
			pieces.set(slot_id, []);

		if (!pieces.get(slot_id).includes(item_id))
			pieces.get(slot_id).push(item_id);
	}

	return pieces;
}

/**
 * The sets a roll draws from: those with visible pieces in at least `min_pieces`
 * armour slots.
 * @param {{id: number, name: string, item_ids: number[]}[]} sets
 * @param {function(number): number|null} slot_of
 * @param {function(number): boolean} is_visible
 * @param {number} [min_pieces]
 * @returns {{id: number, name: string, pieces: Map<number, number[]>}[]}
 */
function eligible_sets(sets, slot_of, is_visible, min_pieces = MIN_SET_PIECES) {
	const eligible = [];
	for (const set of sets) {
		const pieces = armour_pieces(set.item_ids, slot_of, is_visible);
		if (pieces.size >= min_pieces)
			eligible.push({ id: set.id, name: set.name, pieces });
	}

	return eligible;
}

/**
 * Draw one set, one item per slot it covers, and one appearance variant for all of them.
 * @param {{id: number, name: string, pieces: Map<number, number[]>}[]} sets - from eligible_sets
 * @param {function(number): number[]} modifiers_of - item id -> its ItemAppearanceModifierIDs, sorted
 * @param {function(): number} [rng] - returns [0, 1)
 * @returns {{set: object, variant: number|undefined, items: Object<number, number>, skins: Object<number, number>}|null}
 *   `items` and `skins` are keyed by slot id; a slot whose piece lacks the variant has no skin (first look).
 */
function roll_set_outfit(sets, modifiers_of, rng = Math.random) {
	if (sets.length === 0)
		return null;

	const set = pick(sets, rng);
	const items = {};
	for (const [slot_id, item_ids] of set.pieces)
		items[slot_id] = pick(item_ids, rng);

	const variants = new Set();
	for (const item_id of Object.values(items))
		for (const modifier_id of modifiers_of(item_id))
			variants.add(modifier_id);

	const variant = variants.size > 0 ? pick([...variants].sort((a, b) => a - b), rng) : undefined;
	const skins = {};
	for (const [slot_id, item_id] of Object.entries(items)) {
		if (variant !== undefined && modifiers_of(item_id).includes(variant))
			skins[slot_id] = variant;
	}

	return { set, variant, items, skins };
}

/**
 * Put a rolled outfit on: the set's slots are replaced (the shoulder on both sides),
 * every other slot keeps its item and skin.
 * @param {Object<number, number>} equipped - chrEquippedItems
 * @param {Object<number, number>} skins - chrEquippedItemSkins
 * @param {{items: Object<number, number>, skins: Object<number, number>}} outfit - from roll_set_outfit
 * @returns {{equipped: Object<number, number>, skins: Object<number, number>}} new objects
 */
function apply_outfit(equipped, skins, outfit) {
	const new_equipped = { ...equipped };
	const new_skins = { ...skins };

	for (const [key, item_id] of Object.entries(outfit.items)) {
		const slot_id = Number(key);
		const slot_ids = slot_id === SHOULDER_SLOT_L ? [SHOULDER_SLOT_L, SHOULDER_SLOT_R] : [slot_id];
		for (const sid of slot_ids) {
			new_equipped[sid] = item_id;
			if (outfit.skins[slot_id] !== undefined)
				new_skins[sid] = outfit.skins[slot_id];
			else
				delete new_skins[sid];
		}
	}

	return { equipped: new_equipped, skins: new_skins };
}

module.exports = { ARMOUR_SLOTS, MIN_SET_PIECES, armour_pieces, eligible_sets, roll_set_outfit, apply_outfit };
