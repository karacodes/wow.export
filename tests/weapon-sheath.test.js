/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT

	Weapons option (wow-to-stl #338): with weapons sheathed, the main-hand and off-hand items
	hang on the sheath point their Item.SheatheType names instead of in the hands. Two-handers
	cross the back, staves and bows go up the back, one-handers to the hips, shields to the middle
	of the back; items with no sheathe type (wands, off-hand books and orbs) go to the hips too.
	Run with `node --test tests/*.test.js` or `bun test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ATTACHMENT_ID, get_sheath_attachment_id } = require('../src/js/wow/EquipmentSlots');

const MAIN_HAND = 16, OFF_HAND = 17;
const SHEATHE = { NONE: 0, TWO_HAND: 1, LARGE: 2, HIP: 3, SHIELD: 4 };

test('two-handers cross the back, main hand and off hand on opposite sheaths', () => {
	assert.equal(get_sheath_attachment_id(MAIN_HAND, SHEATHE.TWO_HAND), ATTACHMENT_ID.SHEATH_MAIN_HAND);
	assert.equal(get_sheath_attachment_id(OFF_HAND, SHEATHE.TWO_HAND), ATTACHMENT_ID.SHEATH_OFF_HAND);
});

test('staves, polearms and bows go up the back', () => {
	assert.equal(get_sheath_attachment_id(MAIN_HAND, SHEATHE.LARGE), ATTACHMENT_ID.RIGHT_BACK);
	assert.equal(get_sheath_attachment_id(OFF_HAND, SHEATHE.LARGE), ATTACHMENT_ID.LEFT_BACK);
});

test('one-handers go to the hips, one each side', () => {
	assert.equal(get_sheath_attachment_id(MAIN_HAND, SHEATHE.HIP), ATTACHMENT_ID.RIGHT_HIP_SHEATH);
	assert.equal(get_sheath_attachment_id(OFF_HAND, SHEATHE.HIP), ATTACHMENT_ID.LEFT_HIP_SHEATH);
});

test('a shield goes to the middle of the back', () => {
	assert.equal(get_sheath_attachment_id(OFF_HAND, SHEATHE.SHIELD), ATTACHMENT_ID.SHEATH_SHIELD);
});

test('wands, books and orbs (no sheathe type, or one we do not know) go to the hips', () => {
	for (const sheathe_type of [SHEATHE.NONE, 5, 6, 7, undefined]) {
		assert.equal(get_sheath_attachment_id(MAIN_HAND, sheathe_type), ATTACHMENT_ID.RIGHT_HIP_SHEATH, `type ${sheathe_type}`);
		assert.equal(get_sheath_attachment_id(OFF_HAND, sheathe_type), ATTACHMENT_ID.LEFT_HIP_SHEATH, `type ${sheathe_type}`);
	}
});

test('only the hands have sheath points', () => {
	for (const slot_id of [1, 3, 5, 6, 15, 30])
		assert.equal(get_sheath_attachment_id(slot_id, SHEATHE.HIP), null, `slot ${slot_id}`);
});
