/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Regression test for wow-to-stl #125: shields hung in the left palm. The off-hand slot lists
	[HandLeft, Shield], one point per model of the item, so a shield's single model took HandLeft
	and the viewer, the OBJ and the sidecar all showed it held in the hand. A shield (inventory
	type 14) goes on the forearm's Shield point; off-hand weapons and holdables stay in the hand.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ATTACHMENT_ID, get_attachment_ids_for_item } = require('../src/js/wow/EquipmentSlots');

const MAIN_HAND = 16, OFF_HAND = 17, HEAD = 1;
const INV = { HEAD: 1, ONE_HAND: 13, SHIELD: 14, TWO_HAND: 17, OFF_HAND_WEAPON: 22, HOLDABLE: 23 };

// the item's first model is the one an attachment point is picked for
const first_point = (slot_id, item) => get_attachment_ids_for_item(slot_id, item)[0];

test('a shield in the off hand hangs on the Shield point, not in the left palm', () => {
	assert.equal(first_point(OFF_HAND, { inventory_type: INV.SHIELD }), ATTACHMENT_ID.SHIELD);
	assert.deepEqual(get_attachment_ids_for_item(OFF_HAND, { inventory_type: INV.SHIELD }), [ATTACHMENT_ID.SHIELD]);
});

test('off-hand weapons, one-handers and holdables stay in the left hand', () => {
	for (const inventory_type of [INV.OFF_HAND_WEAPON, INV.ONE_HAND, INV.HOLDABLE])
		assert.equal(first_point(OFF_HAND, { inventory_type }), ATTACHMENT_ID.HAND_LEFT, `inventory type ${inventory_type}`);
});

test('an off-hand item of unknown type keeps the slot list', () => {
	assert.deepEqual(get_attachment_ids_for_item(OFF_HAND, {}), [ATTACHMENT_ID.HAND_LEFT, ATTACHMENT_ID.SHIELD]);
	assert.deepEqual(get_attachment_ids_for_item(OFF_HAND), [ATTACHMENT_ID.HAND_LEFT, ATTACHMENT_ID.SHIELD]);
});

test('a bow is held in the left hand, other main-hand items in the right', () => {
	assert.deepEqual(get_attachment_ids_for_item(MAIN_HAND, { inventory_type: INV.TWO_HAND, is_bow: true }), [ATTACHMENT_ID.HAND_LEFT]);
	assert.deepEqual(get_attachment_ids_for_item(MAIN_HAND, { inventory_type: INV.TWO_HAND }), [ATTACHMENT_ID.HAND_RIGHT]);
});

test('the shield rule is the off hand only, and body slots keep their lists', () => {
	assert.deepEqual(get_attachment_ids_for_item(MAIN_HAND, { inventory_type: INV.SHIELD }), [ATTACHMENT_ID.HAND_RIGHT]);
	assert.deepEqual(get_attachment_ids_for_item(HEAD, { inventory_type: INV.HEAD }), [ATTACHMENT_ID.HELMET]);
	assert.deepEqual(get_attachment_ids_for_item(5, { inventory_type: 5 }), []);
});
