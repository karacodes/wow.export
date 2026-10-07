/*!
	wow.export (https://github.com/Kruithne/wow.export)
	License: MIT
 */
const log = require('../../log');
const db2 = require('../../casc/db2');
const DBTextureFileData = require('./DBTextureFileData');

const itemDisplays = new Map();

// ItemDisplayInfoID -> Array indexed by ModelIndex -> texture fileDataIDs for that model,
// in TextureType order. ItemDisplayInfo pairs ModelResourcesID[n] with the rows whose
// ModelIndex is n, so a two-model item (a belt's buckle and band) has two lists.
const itemDisplayModelTextures = new Map();

// ItemDisplayInfoID -> { [TextureType]: texture fileDataIDs }, for the replaceable
// texture types a character model wears (2 = cape)
const itemDisplayTexturesByType = new Map();
let is_initialized = false;

/**
 * Initialize Item Display Info Model Mat Res DB2.
 */
const initializeIDIMMR = async () => {
	if (is_initialized)
		return;

	await DBTextureFileData.ensureInitialized();

	log.write('Loading item display info model mat res...');

	for (const [id, row] of await db2.ItemDisplayInfoModelMatRes.getAllRows()) {
		if (id === 0)
			continue;
		const itemdisplayinfoid = row.ItemDisplayInfoID;
		const matresid = row.MaterialResourcesID;
		const textureFileDataIDs = DBTextureFileData.getTextureFDIDsByMatID(matresid);

		if (textureFileDataIDs !== undefined) {
			if (itemDisplays.has(itemdisplayinfoid))
				itemDisplays.get(itemdisplayinfoid).push(...textureFileDataIDs);
			else
				itemDisplays.set(itemdisplayinfoid, [...textureFileDataIDs]);

			let by_model = itemDisplayModelTextures.get(itemdisplayinfoid);
			if (by_model === undefined) {
				by_model = [];
				itemDisplayModelTextures.set(itemdisplayinfoid, by_model);
			}

			const model_index = row.ModelIndex ?? 0;
			if (by_model[model_index] === undefined)
				by_model[model_index] = [];

			by_model[model_index].push({ textureType: row.TextureType ?? 0, textureFileDataIDs });

			let by_type = itemDisplayTexturesByType.get(itemdisplayinfoid);
			if (by_type === undefined) {
				by_type = {};
				itemDisplayTexturesByType.set(itemdisplayinfoid, by_type);
			}

			const texture_type = row.TextureType ?? 0;
			if (by_type[texture_type] === undefined)
				by_type[texture_type] = [];

			by_type[texture_type].push(...textureFileDataIDs);
		}
	}

	// flatten each model's entries in TextureType order
	for (const by_model of itemDisplayModelTextures.values()) {
		for (let i = 0; i < by_model.length; i++) {
			if (by_model[i] === undefined)
				continue;

			by_model[i].sort((a, b) => a.textureType - b.textureType);
			by_model[i] = by_model[i].flatMap(entry => entry.textureFileDataIDs);
		}
	}

	log.write('Loaded %d item display info model mat res items', itemDisplays.size);
	is_initialized = true;
};

const ensure_initialized = async () => {
	if (!is_initialized)
		await initializeIDIMMR();
};

/**
 * Get texturefile id's by ItemDisplayInfoId
 * @param {number} ItemDisplayInfoId
 * @returns {number[]|undefined}
 */
const getItemDisplayIdTextureFileIds = (ItemDisplayInfoId) => {
	return itemDisplays.get(ItemDisplayInfoId);
};

/**
 * Get texture file id's for one model of an item display.
 * @param {number} ItemDisplayInfoId
 * @param {number} modelIndex - index into ItemDisplayInfo.ModelResourcesID
 * @returns {number[]|undefined}
 */
const getItemDisplayModelTextureFileIds = (ItemDisplayInfoId, modelIndex) => {
	return itemDisplayModelTextures.get(ItemDisplayInfoId)?.[modelIndex];
};

/**
 * Texture file ids of an item display grouped by TextureType (2 = cape).
 * @param {number} ItemDisplayInfoId
 * @returns {Object<number, number[]>|undefined}
 */
const getItemDisplayTextureFileIdsByType = (ItemDisplayInfoId) => {
	return itemDisplayTexturesByType.get(ItemDisplayInfoId);
};

module.exports = {
	initialize: initializeIDIMMR,
	ensureInitialized: ensure_initialized,
	getItemDisplayIdTextureFileIds,
	getItemDisplayModelTextureFileIds,
	getItemDisplayTextureFileIdsByType
};
