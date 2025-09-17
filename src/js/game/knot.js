import { Vector } from "../core/vector";
import { KnotSimplifier } from "./knotSimplifier";
import { GameRoot } from "./root";
import { Node } from "./knotUtils";
import { Strand } from "./knotUtils";

export class Knot {
    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        this.unLeagleMessage = "";
        this.root = root;

        /**
         * @type {Node[]} nodes
         */
        this.nodes = []; // 按扭结序的各坐标点, 构造后可直接遍历, 相当于沿扭结 travel

        /**
         * @type {import("./entity").Entity[]}
         */
        this.crossings = [];

        /**
         * @type {import("./entity").Entity[]}
         */
        this.corners = [];

        if (!this.root.knotSimplifier) {
            this.root.knotSimplifier = new KnotSimplifier(this.root);
        }

        this.rebuild();
    }

    rebuild() {
        this.nodes = [];
        this.crossings = [];
        this.corners = [];
        let reg_entities = [];

        for (let ent of this.root.entityMgr.entities) {
            if (ent.layer === "regular") {
                reg_entities.push(ent);
            }
        }

        // 检查 regular 层的 belt 是否构成合法扭结
        let initEntity = reg_entities[0];
        if (!initEntity) {
            this.clear("请先绘制扭结");
            return;
        }

        if (
            initEntity.components.StaticMapEntity.code < 1 ||
            initEntity.components.StaticMapEntity.code > 3
        ) {
            //不是 belt 的 building
            this.clear("存在非 belt 的建筑块");
            return;
        }
        let initOrigin = initEntity.components.StaticMapEntity.origin;
        if (this.root.map.isCrossingEntity(initOrigin)) {
            if (initEntity.components.StaticMapEntity.rotation % 180 === 0) {
                initEntity = this.root.map.getLayerContentXY(initOrigin.x, initOrigin.y + 1, "regular");
            } else {
                initEntity = this.root.map.getLayerContentXY(initOrigin.x + 1, initOrigin.y, "regular");
            }
            initOrigin = initEntity.components.StaticMapEntity.origin;
        }
        if (this.root.map.isCrossingEntity(initOrigin)) {
            this.clear("连续的 crossing 或 corner");
            return;
        }

        let curEntity = initEntity;
        let mapBeltCount = 0;

        let passedEntities = [];
        passedEntities.push(curEntity);
        let node = this.createNodeFromEntity(
            curEntity,
            "black",
            curEntity.components.StaticMapEntity.rotation,
            false
        );
        this.nodes.push(node);

        // 这种 travel along knot 的做法多次用到, logic.js 中的 定向整理 也用到, 或许可以整理一个 travel 函数, 传入回调
        for (;;) {
            let nextOrigin = this.root.map.getNextOrigin(curEntity);
            let nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
            if (nextEntity === initEntity) {
                break;
            }
            if (!nextEntity) {
                // 未完整闭合
                this.clear("未完整闭合");
                return;
            }
            if (
                passedEntities.indexOf(nextEntity) > 0 &&
                !this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)
            ) {
                // 通常点二次到达
                this.clear("定向整理错误");
                return;
            }
            if (
                passedEntities.indexOf(nextEntity) !== passedEntities.lastIndexOf(nextEntity) &&
                this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)
            ) {
                // crossing 已经经过两次以上
                // 交点的三次到达
                this.clear("定向整理错误");
                return;
            }
            passedEntities.push(nextEntity);
            if (this.root.map.isCrossingEntity(nextOrigin)) {
                if (this.crossings.indexOf(nextEntity) < 0) {
                    // 对于交点会遍历到两次, 但只添加一次
                    this.crossings.push(nextEntity);
                    mapBeltCount++;
                }
                // 交点的 inRot 是之前到达它的 inRot
                let node = this.createNodeFromEntity(
                    nextEntity,
                    "black",
                    curEntity.components.StaticMapEntity.rotation,
                    true
                );
                if (nextEntity.components.StaticMapEntity.rotation === node.outRotation) {
                    node.crosType = "over";
                } else {
                    node.crosType = "under";
                }
                this.nodes.push(node);
                // 这是一个交点, 需要去寻找下一个位置
                let curOrigine = curEntity.components.StaticMapEntity.origin;
                nextOrigin.x = 2 * nextOrigin.x - curOrigine.x;
                nextOrigin.y = 2 * nextOrigin.y - curOrigine.y;
                nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                if (nextEntity === initEntity) {
                    break;
                }
                node = this.createNodeFromEntity(
                    nextEntity,
                    "black",
                    nextEntity.components.StaticMapEntity.rotation,
                    false
                );
                this.nodes.push(node);
            } else if (
                nextEntity.components.StaticMapEntity.code === 2 ||
                nextEntity.components.StaticMapEntity.code === 3
            ) {
                //是 corner
                this.corners.push(nextEntity);
                let node = this.createNodeFromEntity(
                    nextEntity,
                    "black",
                    nextEntity.components.StaticMapEntity.rotation,
                    false
                );
                this.nodes.push(node);
            } else if (nextEntity.components.StaticMapEntity.code !== 1) {
                // 非法
                this.clear("存在非 belt 的建筑块");
                return;
            } else {
                if (!this.root.map.checkNeighborsNull(nextEntity, "regular")) {
                    this.clear("过密 lines");
                    return;
                }
                let node = this.createNodeFromEntity(
                    nextEntity,
                    "black",
                    nextEntity.components.StaticMapEntity.rotation,
                    false
                );
                this.nodes.push(node);
            }
            curEntity = nextEntity;
            mapBeltCount++;
        }

        if (mapBeltCount + 1 !== reg_entities.length) {
            // 有多余 tile
            this.clear("有多余 tile");
            return;
        }

        for (let cros of this.crossings) {
            if (!this.root.map.checkDiagonalEntities(cros.components.StaticMapEntity.origin, "regular")) {
                // 过密位置非法
                this.clear("过密 crossing");
                return;
            }
        }

        for (let cor of this.corners) {
            if (!this.root.map.checkDiagonalEntities(cor.components.StaticMapEntity.origin, "regular")) {
                // 过密位置非法
                this.clear("过密 corner");
                return;
            }
        }
    }

    /**
     *
     * @param {String} msg
     */
    clear(msg) {
        this.unLeagleMessage = msg;
        this.crossings = [];
        this.corners = [];
    }

    /**
     *
     * @returns {String}
     */
    getPDcode() {
        if (!this.nodes.length) {
            return "";
        }
    }

    /**
     *
     * @param { import("../savegame/savegame_typedefs").Entity } entity
     * @param { String } color
     * @param { number } inRot
     * @param { boolean } isCrossing
     * @returns
     */
    createNodeFromEntity(entity, color, inRot, isCrossing) {
        let node = new Node(entity.components.StaticMapEntity.origin);
        node.color = color;
        if (color === "black") {
            node.isCrossing = isCrossing;
            node.isCorner = entity.components.StaticMapEntity.code !== 1;
            switch (entity.components.StaticMapEntity.code) {
                case 1:
                    node.outRotation = inRot;
                    break;
                case 2: // 左转
                    node.outRotation = (inRot + 270) % 360;
                    break;
                case 3:
                    node.outRotation = (inRot + 90) % 360;
                    break;
            }
            return node;
        } else if (color === "green") {
            node.isCorner = entity.components.StaticMapEntity.code !== 27;
            if (node.isCorner) {
                if (entity.components.StaticMapEntity.rotation === inRot) {
                    node.outRotation = (inRot + 90) % 360;
                } else if (entity.components.StaticMapEntity.rotation === (inRot + 90) % 360) {
                    node.outRotation = (inRot + 270) % 360;
                } else {
                    return null;
                }
            } else {
                node.outRotation = inRot;
                node.isCrossing = isCrossing;
            }
            return node;
        }
        return null;
    }

    /**
     *
     * @param {Vector} origin
     * @returns {number}
     */
    getBeltNodeIndex(origin) {
        for (let n of this.nodes) {
            if (n.origin.x === origin.x && n.origin.y === origin.y) {
                return this.nodes.indexOf(n);
            }
        }
        return Infinity;
    }
}
