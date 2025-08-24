import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { STOP_PROPAGATION } from "../core/signal";
import { round2Digits } from "../core/utils";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../core/vector";
import { MetaBeltBuilding } from "./buildings/belt";
import { getBuildingDataFromCode } from "./building_codes";
import { Component } from "./component";
import { enumWireVariant } from "./components/wire";
import { Entity } from "./entity";
import { CHUNK_OVERLAY_RES } from "./map_chunk_view";
import { MetaBuilding } from "./meta_building";
import { GameRoot } from "./root";
import { BeltSystem } from "./systems/belt";
import { WireNetwork } from "./systems/wire";

const logger = createLogger("ingame/logic");

/**
 * Typing helper
 * @typedef {Array<{
 *  entity: Entity,
 *  slot: import("./components/item_ejector").ItemEjectorSlot,
 *  fromTile: Vector,
 *  toDirection: enumDirection
 * }>} EjectorsAffectingTile
 */

/**
 * Typing helper
 * @typedef {Array<{
 *  entity: Entity,
 *  slot: import("./components/item_acceptor").ItemAcceptorSlot,
 *  toTile: Vector,
 *  fromDirection: enumDirection
 * }>} AcceptorsAffectingTile
 */

/**
 * @typedef {{
 *     acceptors: AcceptorsAffectingTile,
 *     ejectors: EjectorsAffectingTile
 * }} AcceptorsAndEjectorsAffectingTile
 */

export class GameLogic {
    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * Checks if the given entity can be placed
     * @param {Entity} entity
     * @param {Object} param0
     * @param {boolean=} param0.allowReplaceBuildings
     * @param {Vector=} param0.offset Optional, move the entity by the given offset first
     * @returns {boolean} true if the entity could be placed there
     */
    checkCanPlaceEntity(entity, { allowReplaceBuildings = true, offset = null }) {
        // Compute area of the building
        const rect = entity.components.StaticMapEntity.getTileSpaceBounds();
        if (offset) {
            rect.x += offset.x;
            rect.y += offset.y;
        }

        // Check the whole area of the building
        for (let x = rect.x; x < rect.x + rect.w; ++x) {
            for (let y = rect.y; y < rect.y + rect.h; ++y) {
                // Check if there is any direct collision
                const otherEntity = this.root.map.getLayerContentXY(x, y, entity.layer);
                if (otherEntity) {
                    const staticComp = otherEntity.components.StaticMapEntity;
                    if (
                        !allowReplaceBuildings ||
                        !staticComp
                            .getMetaBuilding()
                            .getIsReplaceable(staticComp.getVariant(), staticComp.getRotationVariant())
                    ) {
                        // This one is a direct blocker
                        return false;
                    }
                }
            }
        }

        // Perform additional placement checks
        if (this.root.gameMode.getIsEditor()) {
            const toolbar = this.root.hud.parts.buildingsToolbar;
            const id = entity.components.StaticMapEntity.getMetaBuilding().getId();

            if (toolbar.buildingHandles[id].puzzleLocked) {
                return false;
            }
        }

        if (this.root.signals.prePlacementCheck.dispatch(entity, offset) === STOP_PROPAGATION) {
            return false;
        }

        return true;
    }

    
   
    // hook, 在这里处理 定向整理, 绿点设置, 间距调整 等与地图相关的点击操作
    // 或许写到别的地方更好, 或许应该新开一个 class...
    // anyway, 先跑起来再说
    tryPlaceBuildingHook({ origin, rotation, rotationVariant, originalRotation, variant, building }){
        if (building.id === "miner"){ // 开采器, 用来实现定向整理
            console.log("定向整理")
            
            let initEntity = this.root.map.getLayerContentXY(origin.x, origin.y, "regular");
            if (!initEntity)
                return true;
            
            let sMapEntity = initEntity.components.StaticMapEntity;
            if (sMapEntity.code != 1)    // 是 corner, 不处理
                return true;
            if ((sMapEntity.rotation - rotation + 180) % 180  !== 0){ // 与目标定向成垂直关系, 不处理
                return true;
            } 
            if (this.root.map.isCrossingEntity(sMapEntity.origin)){
                return true;
            }

            // 设置不进行周围自动处理
            this.root.systemMgr.systems.belt.bUpdateSurrounding = false;

            // 确实与目标定向相同或相反            
            sMapEntity.rotation = sMapEntity.originalRotation = rotation;
            let curEntity = initEntity;
            let nextOrigin = null;
            let nextEntity = null;

            while (true) {
                //console.log (curEntity);
                nextOrigin = this.root.map.getNextOrigin(curEntity);
                //console.log(nextOrigin)
                nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                if (!nextEntity)
                    break;

                if (this.root.map.isCrossingEntity(nextOrigin)) {
                    //console.log("crossing!")
                    //console.log(nextEntity.components.StaticMapEntity.rotation, curEntity.components.StaticMapEntity.rotation)
                    if ((nextEntity.components.StaticMapEntity.rotation - curEntity.components.StaticMapEntity.rotation + 180) % 180  === 0 ) { // 如果上上方弧段
                        //&& nextEntity.components.StaticMapEntity.rotation !== curEntity.components.StaticMapEntity.rotation
                        //console.log("===================上方弧段=============================")
                        //console.log(nextEntity.components.StaticMapEntity.rotation, curEntity.components.StaticMapEntity.rotation)
                        //nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                        nextEntity.components.StaticMapEntity.rotation = curEntity.components.StaticMapEntity.rotation;
                        //nextEntity.components.StaticMapEntity.originalRotation = curEntity.components.StaticMapEntity.originalRotation;
                        // let _building = new MetaBeltBuilding();
                        // let oriRot, rotVar;
                        // oriRot = curEntity.components.StaticMapEntity.originalRotation;
                        // rotVar = 0;

                        // let entity = _building.createEntity({
                        //     root: this.root,
                        //     origin: nextOrigin,
                        //     rotation: curEntity.components.StaticMapEntity.originalRotation,
                        //     originalRotation: oriRot,
                        //     rotationVariant: rotVar,
                        //     variant: "default"
                            
                        // });
    
    
                        // this.freeEntityAreaBeforeBuild(entity);
                        // this.root.map.placeStaticEntity(entity);
                        // this.root.entityMgr.registerEntity(entity);

                        // curEntity = entity;

                        // continue;
                    }

                    // 这是一个交点, 需要去寻找下一个位置
                    let curOrigine = curEntity.components.StaticMapEntity.origin;
                    nextOrigin.x = 2 * nextOrigin.x - curOrigine.x;
                    nextOrigin.y = 2 * nextOrigin.y - curOrigine.y;
                    nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                }
                if (nextEntity === initEntity)
                    break;
                let entity = nextEntity;
                // 设置下一个位置上的定向
                if (nextEntity.components.StaticMapEntity.rotation !== curEntity.components.StaticMapEntity.rotation) {
                    // 如果 rot 不同
                    let _building = new MetaBeltBuilding();
                    let oriRot, rotVar;
                    switch (nextEntity.components.StaticMapEntity.code) {
                        case 1: // 通常 belt
                            oriRot = curEntity.components.StaticMapEntity.originalRotation;
                            rotVar = 0;
                            break;
                        case 2: // 左转 belt
                            //nextEntity.components.StaticMapEntity.code = 2;
                            oriRot = (curEntity.components.StaticMapEntity.originalRotation + 90) % 360;
                            rotVar = 2;
                            break;
                        case 3: // 右转 belt
                            //nextEntity.components.StaticMapEntity.code = 1;
                            oriRot = (curEntity.components.StaticMapEntity.originalRotation + 270) % 360;
                            rotVar = 1;
                            break;
                    }

                    entity = _building.createEntity({
                        root: this.root,
                        origin: nextEntity.components.StaticMapEntity.origin,
                        rotation: curEntity.components.StaticMapEntity.originalRotation,
                        originalRotation: oriRot,
                        rotationVariant: rotVar,
                        variant: "default"
                    });


                    this.freeEntityAreaBeforeBuild(entity);
                    this.root.map.placeStaticEntity(entity);
                    this.root.entityMgr.registerEntity(entity);
                }

                curEntity = entity;
            }

            // 恢复周围自动处理
            this.root.systemMgr.systems.belt.bUpdateSurrounding = true; 


            return true; // true for handled
        }
            return false;
    }

    /**
     * Attempts to place the given building
     * @param {object} param0
     * @param {Vector} param0.origin
     * @param {number} param0.rotation
     * @param {number} param0.originalRotation
     * @param {number} param0.rotationVariant
     * @param {string} param0.variant
     * @param {MetaBuilding} param0.building
     * @returns {Entity}
     */
    tryPlaceBuilding({ origin, rotation, rotationVariant, originalRotation, variant, building }) {

        if (this.tryPlaceBuildingHook({ origin, rotation, rotationVariant, originalRotation, variant, building })){
            // 已经 hook 过, 不再执行实际放置
            return null;
        }

        const entity = building.createEntity({
            root: this.root,
            origin,
            rotation,
            originalRotation,
            rotationVariant,
            variant,
        });
        if (this.checkCanPlaceEntity(entity, {})) {
            this.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
            return entity;
        }
        return null;
    }

    /**
     * Removes all entities with a RemovableMapEntityComponent which need to get
     * removed before placing this entity
     * @param {Entity} entity
     */
    freeEntityAreaBeforeBuild(entity) {
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        // Remove any removeable colliding entities on the same layer
        for (let x = rect.x; x < rect.x + rect.w; ++x) {
            for (let y = rect.y; y < rect.y + rect.h; ++y) {
                const contents = this.root.map.getLayerContentXY(x, y, entity.layer);
                if (contents) {
                    const staticComp = contents.components.StaticMapEntity;
                    assertAlways(
                        staticComp
                            .getMetaBuilding()
                            .getIsReplaceable(staticComp.getVariant(), staticComp.getRotationVariant()),
                        "Tried to replace non-repleaceable entity"
                    );
                    if (!this.tryDeleteBuilding(contents)) {
                        assertAlways(false, "Tried to replace non-repleaceable entity #2");
                    }
                }
            }
        }

        // Perform other callbacks
        this.root.signals.freeEntityAreaBeforeBuild.dispatch(entity);
    }

    /**
     * Performs a bulk operation, not updating caches in the meantime
     * @param {function} operation
     */
    performBulkOperation(operation) {
        logger.warn("Running bulk operation ...");
        assert(!this.root.bulkOperationRunning, "Can not run two bulk operations twice");
        this.root.bulkOperationRunning = true;
        const now = performance.now();
        const returnValue = operation();
        const duration = performance.now() - now;
        logger.log("Done in", round2Digits(duration), "ms");
        assert(this.root.bulkOperationRunning, "Bulk operation = false while bulk operation was running");
        this.root.bulkOperationRunning = false;
        this.root.signals.bulkOperationFinished.dispatch();
        return returnValue;
    }

    /**
     * Performs a immutable operation, causing no recalculations
     * @param {function} operation
     */
    performImmutableOperation(operation) {
        logger.warn("Running immutable operation ...");
        assert(!this.root.immutableOperationRunning, "Can not run two immutalbe operations twice");
        this.root.immutableOperationRunning = true;
        const now = performance.now();
        const returnValue = operation();
        const duration = performance.now() - now;
        logger.log("Done in", round2Digits(duration), "ms");
        assert(
            this.root.immutableOperationRunning,
            "Immutable operation = false while immutable operation was running"
        );
        this.root.immutableOperationRunning = false;
        this.root.signals.immutableOperationFinished.dispatch();
        return returnValue;
    }

    /**
     * Returns whether the given building can get removed
     * @param {Entity} building
     */
    canDeleteBuilding(building) {
        const staticComp = building.components.StaticMapEntity;
        return staticComp.getMetaBuilding().getIsRemovable(this.root);
    }

    /**
     * Tries to delete the given building
     * @param {Entity} building
     */
    tryDeleteBuilding(building) {
        if (!this.canDeleteBuilding(building)) {
            return false;
        }
        this.root.map.removeStaticEntity(building);
        this.root.entityMgr.destroyEntity(building);
        this.root.entityMgr.processDestroyList();
        return true;
    }

    /**
     *
     * Computes the flag for a given tile
     * @param {object} param0
     * @param {enumWireVariant} param0.wireVariant
     * @param {Vector} param0.tile The tile to check at
     * @param {enumDirection} param0.edge The edge to check for
     */
    computeWireEdgeStatus({ wireVariant, tile, edge }) {
        const offset = enumDirectionToVector[edge];
        const targetTile = tile.add(offset);

        // Search for relevant pins
        const pinEntities = this.root.map.getLayersContentsMultipleXY(targetTile.x, targetTile.y);

        // Go over all entities which could have a pin
        for (let i = 0; i < pinEntities.length; ++i) {
            const pinEntity = pinEntities[i];
            const pinComp = pinEntity.components.WiredPins;
            const staticComp = pinEntity.components.StaticMapEntity;

            // Skip those who don't have pins
            if (!pinComp) {
                continue;
            }

            // Go over all pins
            const pins = pinComp.slots;
            for (let k = 0; k < pinComp.slots.length; ++k) {
                const pinSlot = pins[k];
                const pinLocation = staticComp.localTileToWorld(pinSlot.pos);
                const pinDirection = staticComp.localDirectionToWorld(pinSlot.direction);

                // Check if the pin has the right location
                if (!pinLocation.equals(targetTile)) {
                    continue;
                }

                // Check if the pin has the right direction
                if (pinDirection !== enumInvertedDirections[edge]) {
                    continue;
                }

                // Found a pin!
                return true;
            }
        }

        // Now check if there's a connectable entity on the wires layer
        const targetEntity = this.root.map.getTileContent(targetTile, "wires");
        if (!targetEntity) {
            return false;
        }

        const targetStaticComp = targetEntity.components.StaticMapEntity;

        // Check if its a crossing
        const wireTunnelComp = targetEntity.components.WireTunnel;
        if (wireTunnelComp) {
            return true;
        }

        // Check if its a wire
        const wiresComp = targetEntity.components.Wire;
        if (!wiresComp) {
            return false;
        }

        // It's connected if its the same variant
        return wiresComp.variant === wireVariant;
    }

    /**
     * Returns all wire networks this entity participates in on the given tile
     * @param {Entity} entity
     * @param {Vector} tile
     * @returns {Array<WireNetwork>|null} Null if the entity is never able to be connected at the given tile
     */
    getEntityWireNetworks(entity, tile) {
        let canConnectAtAll = false;

        /** @type {Set<WireNetwork>} */
        const networks = new Set();

        const staticComp = entity.components.StaticMapEntity;
        const wireComp = entity.components.Wire;
        if (wireComp) {
            canConnectAtAll = true;
            if (wireComp.linkedNetwork) {
                networks.add(wireComp.linkedNetwork);
            }
        }

        const tunnelComp = entity.components.WireTunnel;
        if (tunnelComp) {
            canConnectAtAll = true;
            for (let i = 0; i < tunnelComp.linkedNetworks.length; ++i) {
                networks.add(tunnelComp.linkedNetworks[i]);
            }
        }

        const pinsComp = entity.components.WiredPins;
        if (pinsComp) {
            const slots = pinsComp.slots;
            for (let i = 0; i < slots.length; ++i) {
                const slot = slots[i];
                const slotLocalPos = staticComp.localTileToWorld(slot.pos);
                if (slotLocalPos.equals(tile)) {
                    canConnectAtAll = true;
                    if (slot.linkedNetwork) {
                        networks.add(slot.linkedNetwork);
                    }
                }
            }
        }

        if (!canConnectAtAll) {
            return null;
        }

        return Array.from(networks);
    }

    /**
     * Returns if the entities tile *and* his overlay matrix is intersected
     * @param {Entity} entity
     * @param {Vector} worldPos
     */
    getIsEntityIntersectedWithMatrix(entity, worldPos) {
        const staticComp = entity.components.StaticMapEntity;
        const tile = worldPos.toTileSpace();

        if (!staticComp.getTileSpaceBounds().containsPoint(tile.x, tile.y)) {
            // No intersection at all
            return;
        }

        const data = getBuildingDataFromCode(staticComp.code);
        const overlayMatrix = data.metaInstance.getSpecialOverlayRenderMatrix(
            staticComp.rotation,
            data.rotationVariant,
            data.variant,
            entity
        );
        // Always the same
        if (!overlayMatrix) {
            return true;
        }

        const localPosition = worldPos
            .divideScalar(globalConfig.tileSize)
            .modScalar(1)
            .multiplyScalar(CHUNK_OVERLAY_RES)
            .floor();

        return !!overlayMatrix[localPosition.x + localPosition.y * 3];
    }

    /**
     * Returns the acceptors and ejectors which affect the current tile
     * @param {Vector} tile
     * @returns {AcceptorsAndEjectorsAffectingTile}
     */
    getEjectorsAndAcceptorsAtTile(tile) {
        /** @type {EjectorsAffectingTile} */
        let ejectors = [];
        /** @type {AcceptorsAffectingTile} */
        let acceptors = [];

        // Well .. please ignore this code! :D
        for (let dx = -1; dx <= 1; ++dx) {
            for (let dy = -1; dy <= 1; ++dy) {
                if (Math.abs(dx) + Math.abs(dy) !== 1) {
                    continue;
                }

                const entity = this.root.map.getLayerContentXY(tile.x + dx, tile.y + dy, "regular");
                if (entity) {
                    /**
                     * @type {Array<import("./components/item_ejector").ItemEjectorSlot>}
                     */
                    let ejectorSlots = [];

                    /**
                     * @type {Array<import("./components/item_acceptor").ItemAcceptorSlot>}
                     */
                    let acceptorSlots = [];

                    const staticComp = entity.components.StaticMapEntity;
                    const itemEjector = entity.components.ItemEjector;
                    const itemAcceptor = entity.components.ItemAcceptor;
                    const beltComp = entity.components.Belt;

                    if (itemEjector) {
                        ejectorSlots = itemEjector.slots.slice();
                    }

                    if (itemAcceptor) {
                        acceptorSlots = itemAcceptor.slots.slice();
                    }

                    if (beltComp) {
                        const fakeEjectorSlot = beltComp.getFakeEjectorSlot();
                        const fakeAcceptorSlot = beltComp.getFakeAcceptorSlot();
                        ejectorSlots.push(fakeEjectorSlot);
                        acceptorSlots.push(fakeAcceptorSlot);
                    }

                    for (let ejectorSlot = 0; ejectorSlot < ejectorSlots.length; ++ejectorSlot) {
                        const slot = ejectorSlots[ejectorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        const wsDirection = staticComp.localDirectionToWorld(slot.direction);
                        const targetTile = wsTile.add(enumDirectionToVector[wsDirection]);
                        if (targetTile.equals(tile)) {
                            ejectors.push({
                                entity,
                                slot,
                                fromTile: wsTile,
                                toDirection: wsDirection,
                            });
                        }
                    }

                    for (let acceptorSlot = 0; acceptorSlot < acceptorSlots.length; ++acceptorSlot) {
                        const slot = acceptorSlots[acceptorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        const direction = slot.direction;
                        const wsDirection = staticComp.localDirectionToWorld(direction);
                        const sourceTile = wsTile.add(enumDirectionToVector[wsDirection]);
                        if (sourceTile.equals(tile)) {
                            acceptors.push({
                                entity,
                                slot,
                                toTile: wsTile,
                                fromDirection: wsDirection,
                            });
                        }
                    }
                }
            }
        }
        return { ejectors, acceptors };
    }

    /**
     * Clears all belts and items
     */
    clearAllBeltsAndItems() {
        for (const entity of this.root.entityMgr.entities) {
            for (const component of Object.values(entity.components)) {
                /** @type {Component} */ (component).clear();
            }
        }
    }
}
