import { globalConfig } from "../core/config";
import { Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { BaseItem } from "./base_item";
import { Entity } from "./entity";
import { MapChunkAggregate } from "./map_chunk_aggregate";
import { MapChunkView } from "./map_chunk_view";
import { GameRoot } from "./root";

export class BaseMap extends BasicSerializableObject {
    static getId() {
        return "Map";
    }

    static getSchema() {
        return {
            seed: types.uint,
        };
    }

    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        super();
        this.root = root;

        this.seed = 0;

        /**
         * Mapping of 'X|Y' to chunk
         * @type {Map<string, MapChunkView>} */
        this.chunksById = new Map();

        /**
         * Mapping of 'X|Y' to chunk aggregate
         * @type {Map<string, MapChunkAggregate>} */
        this.aggregatesById = new Map();
    }

    /**
     * Returns the given chunk by index
     * @param {number} chunkX
     * @param {number} chunkY
     */
    getChunk(chunkX, chunkY, createIfNotExistent = false) {
        const chunkIdentifier = chunkX + "|" + chunkY;
        let storedChunk;

        if ((storedChunk = this.chunksById.get(chunkIdentifier))) {
            return storedChunk;
        }

        if (createIfNotExistent) {
            const instance = new MapChunkView(this.root, chunkX, chunkY);
            this.chunksById.set(chunkIdentifier, instance);
            return instance;
        }

        return null;
    }

    /**
     * Returns the chunk aggregate containing a given chunk
     * @param {number} chunkX
     * @param {number} chunkY
     */
    getAggregateForChunk(chunkX, chunkY, createIfNotExistent = false) {
        const aggX = Math.floor(chunkX / globalConfig.chunkAggregateSize);
        const aggY = Math.floor(chunkY / globalConfig.chunkAggregateSize);
        return this.getAggregate(aggX, aggY, createIfNotExistent);
    }

    /**
     * Returns the given chunk aggregate by index
     * @param {number} aggX
     * @param {number} aggY
     */
    getAggregate(aggX, aggY, createIfNotExistent = false) {
        const aggIdentifier = aggX + "|" + aggY;
        let storedAggregate;

        if ((storedAggregate = this.aggregatesById.get(aggIdentifier))) {
            return storedAggregate;
        }

        if (createIfNotExistent) {
            const instance = new MapChunkAggregate(this.root, aggX, aggY);
            this.aggregatesById.set(aggIdentifier, instance);
            return instance;
        }

        return null;
    }

    /**
     * Gets or creates a new chunk if not existent for the given tile
     * @param {number} tileX
     * @param {number} tileY
     * @returns {MapChunkView}
     */
    getOrCreateChunkAtTile(tileX, tileY) {
        const chunkX = Math.floor(tileX / globalConfig.mapChunkSize);
        const chunkY = Math.floor(tileY / globalConfig.mapChunkSize);
        return this.getChunk(chunkX, chunkY, true);
    }

    /**
     * Gets a chunk if not existent for the given tile
     * @param {number} tileX
     * @param {number} tileY
     * @returns {MapChunkView?}
     */
    getChunkAtTileOrNull(tileX, tileY) {
        const chunkX = Math.floor(tileX / globalConfig.mapChunkSize);
        const chunkY = Math.floor(tileY / globalConfig.mapChunkSize);
        return this.getChunk(chunkX, chunkY, false);
    }

    /**
     * Checks if a given tile is within the map bounds
     * @param {Vector} tile
     * @returns {boolean}
     */
    isValidTile(tile) {
        if (G_IS_DEV) {
            assert(tile instanceof Vector, "tile is not a vector");
        }
        return Number.isInteger(tile.x) && Number.isInteger(tile.y);
    }

    /**
     * Returns the tile content of a given tile
     * @param {Vector} tile
     * @param {Layer} layer
     * @returns {Entity} Entity or null
     */
    getTileContent(tile, layer) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);
        return chunk && chunk.getLayerContentFromWorldCoords(tile.x, tile.y, layer);
    }

    /**
     * Returns the lower layers content of the given tile
     * @param {number} x
     * @param {number} y
     * @returns {BaseItem=}
     */
    getLowerLayerContentXY(x, y) {
        return this.getOrCreateChunkAtTile(x, y).getLowerLayerFromWorldCoords(x, y);
    }

    /**
     * Returns the tile content of a given tile
     * @param {number} x
     * @param {number} y
     * @param {Layer} layer
     * @returns {Entity} Entity or null
     */
    getLayerContentXY(x, y, layer) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        return chunk && chunk.getLayerContentFromWorldCoords(x, y, layer);
    }

    /**
     * 
     * @param {Entity} entity 
     * @returns {boolean}
     */
    checkNeighborsNull(entity, layer){
        let sMapEntity = entity.components.StaticMapEntity;
        // if (sMapEntity.code !== 1){
        //     return true;
        // }
        if (sMapEntity.rotation % 180 === 0){
            if (this.getLayerContentXY(sMapEntity.origin.x - 1, sMapEntity.origin.y, layer)){
                return false;
            }
            if (this.getLayerContentXY(sMapEntity.origin.x + 1, sMapEntity.origin.y, layer)){
                return false;
            }
        } else {
            if (this.getLayerContentXY(sMapEntity.origin.x, sMapEntity.origin.y - 1, layer)){
                return false;
            }
            if (this.getLayerContentXY(sMapEntity.origin.x, sMapEntity.origin.y + 1, layer)){
                return false;
            }
        }
        return true;
    }

    /**
     * 判断对角线上 4 个临接位置全空, 检查合法性
     * @param {Vector} origin 
     * @returns {boolean}
     */
    checkDiagonalEntities(origin) {
        if (this.getLayerContentXY(origin.x - 1, origin.y - 1, "regular")){
            return false;
        }
        if (this.getLayerContentXY(origin.x - 1, origin.y + 1, "regular")){
            return false;
        }
        if (this.getLayerContentXY(origin.x + 1, origin.y - 1, "regular")){
            return false;
        }
        if (this.getLayerContentXY(origin.x + 1, origin.y + 1, "regular")){
            return false;
        }
        return true;
    }
    /**
     * 获取地图上一个 belt 的出口下一个位置
     * @param {Entity} entity
     * @returns {Vector}
    */
     getNextOrigin(entity){  
        let sMapEntity = entity.components.StaticMapEntity;
        if (!sMapEntity)
            return null;
        let outRot;
        switch (sMapEntity.code){
            case 1: // 通常 belt
                outRot = sMapEntity.rotation;
                break;
            case 2: // 左转 belt
                outRot = (sMapEntity.rotation  + 270) % 360;
                break;
            case 3: // 右转 belt
                outRot = (sMapEntity.rotation  + 90) % 360;
                break;
        }
        
        let nextEntity = new Vector();
        switch (outRot){
            case 0: // 上
                nextEntity.x = sMapEntity.origin.x;
                nextEntity.y = sMapEntity.origin.y -1;
                break;
            case 90: // 右
                nextEntity.x = sMapEntity.origin.x + 1;
                nextEntity.y = sMapEntity.origin.y;
                break;
            case 180: // 下
                nextEntity.x = sMapEntity.origin.x;
                nextEntity.y = sMapEntity.origin.y + 1;
                break;
            case 270: // 左
                nextEntity.x = sMapEntity.origin.x - 1;
                nextEntity.y = sMapEntity.origin.y;
                break;
        }
        return nextEntity;
    }

    /**
     * 判断这个位置上的 belt 是否是一个 crossing, 依据它是否有 4 个临接 belt (忽略定向)
     * @param {Vector} ori 
     * @returns {boolean} 
     */
    isCrossingEntity(ori) {
        const { ejectors, acceptors } = this.root.logic.getEjectorsAndAcceptorsAtTile(ori);  
        if (ejectors.length + acceptors.length === 4) {  
            return true;
        } else {
            return false;
        }
    }

    /**
     * Returns the tile contents of a given tile
     * @param {number} x
     * @param {number} y
     * @returns {Array<Entity>} Entity or null
     */
    getLayersContentsMultipleXY(x, y) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        if (!chunk) {
            return [];
        }
        return chunk.getLayersContentsMultipleFromWorldCoords(x, y);
    }

    /**
     * Checks if the tile is used
     * @param {Vector} tile
     * @param {Layer} layer
     * @returns {boolean}
     */
    isTileUsed(tile, layer) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);
        return chunk && chunk.getLayerContentFromWorldCoords(tile.x, tile.y, layer) != null;
    }

    /**
     * Checks if the tile is used
     * @param {number} x
     * @param {number} y
     * @param {Layer} layer
     * @returns {boolean}
     */
    isTileUsedXY(x, y, layer) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        return chunk && chunk.getLayerContentFromWorldCoords(x, y, layer) != null;
    }

    /**
     * Sets the tiles content
     * @param {Vector} tile
     * @param {Entity} entity
     */
    setTileContent(tile, entity) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }

        this.getOrCreateChunkAtTile(tile.x, tile.y).setLayerContentFromWorldCords(
            tile.x,
            tile.y,
            entity,
            entity.layer
        );

        const staticComponent = entity.components.StaticMapEntity;
        assert(staticComponent, "Can only place static map entities in tiles");
    }

    /**
     * Places an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    placeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        for (let dx = 0; dx < rect.w; ++dx) {
            for (let dy = 0; dy < rect.h; ++dy) {
                const x = rect.x + dx;
                const y = rect.y + dy;
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, entity, entity.layer);
            }
        }
    }

    /**
     * Removes an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    removeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        for (let dx = 0; dx < rect.w; ++dx) {
            for (let dy = 0; dy < rect.h; ++dy) {
                const x = rect.x + dx;
                const y = rect.y + dy;
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, null, entity.layer);
            }
        }
    }

    // Internal

    /**
     * Checks a given tile for validty
     * @param {Vector} tile
     */
    internalCheckTile(tile) {
        assert(tile instanceof Vector, "tile is not a vector: " + tile);
        assert(tile.x % 1 === 0, "Tile X is not a valid integer: " + tile.x);
        assert(tile.y % 1 === 0, "Tile Y is not a valid integer: " + tile.y);
    }
}
