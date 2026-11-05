/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	The sidecar row of an equipped item model (src/js/wow/sidecar-equipment.js) carries the
	game's item name, so WoW Print can show "Seven Sacred Seals" instead of "Main Hand 128870"
	(wow-to-stl #301). Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { item_name, equipment_row } = require('../src/js/wow/sidecar-equipment');

const ITEMS = new Map([
	[128870, { id: 128870, name: 'The Kingslayers', inventoryType: 13 }],
	[1168, { id: 1168, name: 'Unknown item #1168', inventoryType: 14 }]
]);

const lookups = {
	slot_name: slot => ({ 16: 'Main-hand', 17: 'Off-hand' })[slot] ?? null,
	display_id: () => 4242,
	item: item_id => ITEMS.get(item_id) ?? null
};

const main_hand = { slot_id: 16, item_id: 128870, modifier_id: 0, model_index: 1, attachment_id: 1, is_collection_style: false, renderer: { item_file_data_id: 1135178 }, textures: [] };

test('an equipped item\'s row carries the game\'s item name', () => {
	const row = equipment_row(main_hand, 3, lookups);
	assert.equal(row.name, 'The Kingslayers');
	assert.equal(row.itemID, 128870);
	assert.equal(row.slotName, 'Main-hand');
});

test('the row keeps the fields the sidecar had before the name', () => {
	assert.deepEqual(equipment_row(main_hand, 3, lookups), {
		equipmentIndex: 3, slot: 16, slotName: 'Main-hand', itemID: 128870, name: 'The Kingslayers',
		displayID: 4242, modifierID: 0, modelFileDataID: 1135178, modelIndex: 1, attachmentID: 1,
		style: 'attachment', textures: []
	});
});

test('an item the game has no name for gets a null name, not a stand-in', () => {
	assert.equal(equipment_row({ ...main_hand, slot_id: 17, item_id: 1168 }, 0, lookups).name, null);
	assert.equal(equipment_row({ ...main_hand, item_id: 999999 }, 0, lookups).name, null);
});

test('item names are trimmed; empty names are none', () => {
	assert.equal(item_name({ name: '  Seven Sacred Seals ' }), 'Seven Sacred Seals');
	assert.equal(item_name({ name: '   ' }), null);
	assert.equal(item_name({ name: null }), null);
	assert.equal(item_name(null), null);
});

test('a collection model has no attachment point', () => {
	const row = equipment_row({ ...main_hand, is_collection_style: true }, 0, lookups);
	assert.equal(row.style, 'collection');
	assert.equal(row.attachmentID, null);
});
