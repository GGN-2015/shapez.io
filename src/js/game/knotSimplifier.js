import { Vector } from "../core/vector";
import { enumNotificationType } from "./hud/parts/notifications";
import { GameRoot } from "./root";
import { MetaWireBuilding } from "./buildings/wire";
import { MetaBeltBuilding } from "./buildings/belt";
import { Node } from "./knotUtils";
import { Strand } from "./knotUtils";

export class KnotSimplifier {
    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;

        /**
         * @type {Node[]} greenNodes
         */
        this.greenNodes; // 绿线上的节点

        /**
         * @type {Vector[]}
         */
        this.seperators;

        /**
         * @type {boolean}
         */
        this.readyToMove;

        /**
         * @type {{ gNodes: any; rPath: any; rPathDir: any;}[]}
         */
        this.check_result_array;

        /**
         * @type {number}
         */
        this.checkResultIndex;

        /**
         * @type { import("./entity").Entity[]}
         */
        this.hiddenNodes;

        this.redBlackSameDirection;
        /**
         * @type {Node[]} redPathForward
         */
        this.redPathForward;
        /**
         * @type {Node[]} redPathReverse
         */
        this.redPathReverse;
        //this.greenCrossings = [];

        this.rebuild();
    }

    rebuild() {
        this.greenNodes = [];
        this.seperators = [];
        this.readyToMove = false;

        this.check_result_array = [];
        this.checkResultIndex = 0;

        this.hiddenNodes = [];
        this.redBlackSameDirection = true;
        this.redPathForward = [];
        this.redPathReverse = [];
        let del_entities = [];

        for (let ent of this.root.entityMgr.entities) {
            if (ent.layer === "wires" && ent.components.StaticMapEntity.code === 39) {
                // seprator
                if (!this.checkSeperatorIleagle(ent.components.StaticMapEntity.origin)) {
                    this.seperators.push(ent.components.StaticMapEntity.origin);
                } else {
                    del_entities.push(ent);
                }
            } else if (
                ent.layer === "wires" &&
                (ent.components.StaticMapEntity.code === 52 || ent.components.StaticMapEntity.code === 53)
            ) {
                // 红线
                del_entities.push(ent);
            }
        }
        for (let de of del_entities) {
            if (this && !de.destroyed) this.root.logic.tryDeleteBuilding(de);
        }
    }

    /**
     * 返回 true 表示非法
     * @param {Vector} origin
     * @returns {boolean}
     */
    checkSeperatorIleagle(origin) {
        let entity = this.root.map.getLayerContentXY(origin.x, origin.y, "regular");
        if (!entity) {
            this.root.hud.signals.notification.dispatch("只能在扭结上设置分割点", enumNotificationType.error);
            return true;
        }
        if (this.root.map.isCrossingEntity(origin)) {
            this.root.hud.signals.notification.dispatch("不能在交点上设置分割点", enumNotificationType.error);
            return true;
        }
        if (
            this.root.map.isCrossingEntity(new Vector(origin.x - 1, origin.y)) ||
            this.root.map.isCrossingEntity(new Vector(origin.x + 1, origin.y)) ||
            this.root.map.isCrossingEntity(new Vector(origin.x, origin.y - 1)) ||
            this.root.map.isCrossingEntity(new Vector(origin.x, origin.y + 1))
        ) {
            this.root.hud.signals.notification.dispatch("不能离交点太近", enumNotificationType.error);
            return true;
        }
        if (
            this.root.map.isCornerEntity(new Vector(origin.x - 1, origin.y)) ||
            this.root.map.isCornerEntity(new Vector(origin.x + 1, origin.y)) ||
            this.root.map.isCornerEntity(new Vector(origin.x, origin.y - 1)) ||
            this.root.map.isCornerEntity(new Vector(origin.x, origin.y + 1))
        ) {
            this.root.hud.signals.notification.dispatch(
                "不能离 corner 太近 (可以设置在 corner 上)",
                enumNotificationType.error
            );
            return true;
        }
        if (this.seperators.length > 2) {
            this.root.hud.signals.notification.dispatch("只能设置两个分割点", enumNotificationType.error);
            return true;
        }
        // this.root.knot.seperators.push(origin);
        return false;
    }

    deleteRedLine() {
        let toDel = [];
        for (let ent of this.root.entityMgr.entities) {
            if (
                ent.layer === "wires" &&
                (ent.components.StaticMapEntity.code === 52 || ent.components.StaticMapEntity.code === 53)
            ) {
                // 红线
                toDel.push(ent);
            }
        }
        for (let de of toDel) {
            if (!de.destroyed) {
                this.root.logic.tryDeleteBuilding(de);
            }
        }
    }

    /**
     *
     * @param {boolean} bForward
     * @param {Node[]} redPath
     */
    initRedPath(bForward, redPath) {
        let startOrigin;
        let endOrigine;
        if (bForward) {
            startOrigin = this.seperators[0];
            endOrigine = this.seperators[1];
        } else {
            startOrigin = this.seperators[1];
            endOrigine = this.seperators[0];
        }

        let initIndex = (this.root.knot.getBeltNodeIndex(startOrigin) + 1) % this.root.knot.nodes.length;
        let lastIndex = (this.root.knot.getBeltNodeIndex(endOrigine) + 1) % this.root.knot.nodes.length;
        let curIndex = initIndex;
        for (;;) {
            let curNode = this.root.knot.nodes[curIndex];
            if ((curIndex + 1) % this.root.knot.nodes.length === lastIndex) {
                break;
            }
            for (let no of redPath) {
                if (no.origin.equals(curNode.origin)) {
                    // 红线有自交,
                    redPath.length = 0;
                    return;
                }
            }
            for (let no of this.greenNodes) {
                if (no.origin.equals(curNode.origin)) {
                    // 与绿线相交,
                    redPath.length = 0;
                    return;
                }
            }
            redPath.push(curNode);
            curIndex = (curIndex + 1) % this.root.knot.nodes.length;
        }

        for (let rNode of redPath) {
            if (!rNode.isCrossing) {
                continue;
            }
            let belowEnt = this.root.map.getLayerContentXY(rNode.origin.x, rNode.origin.y, "regular");
            if (rNode.outRotation === belowEnt.components.StaticMapEntity.rotation) {
                rNode.crosType = "under";
            } else {
                rNode.crosType = "over";
            }
        }
    }

    /**
     * 重整绿线的定向, 为后面确定穿越圆盘的左右做准备
     * @returns {boolean}
     */
    reDirectionGreenLine() {
        this.deleteRedLine();
        this.greenNodes = [];
        //this.greenCrossings = []
        let startSep = this.seperators[0];
        let belowBelt = this.root.map.getLayerContentXY(startSep.x, startSep.y, "regular");
        let initGreen;

        let neighbors = [];
        neighbors.push(new Vector(startSep.x, startSep.y - 1));
        neighbors.push(new Vector(startSep.x + 1, startSep.y));
        neighbors.push(new Vector(startSep.x, startSep.y + 1));
        neighbors.push(new Vector(startSep.x - 1, startSep.y));

        for (let nei of neighbors) {
            initGreen = this.root.map.getLayerContentXY(nei.x, nei.y, "wires");
            if (initGreen) {
                initGreen.components.StaticMapEntity.rotation = neighbors.indexOf(nei) * 90;
                break;
            }
        }

        if (!initGreen) {
            this.root.hud.signals.notification.dispatch(
                "没有找到连接两个分离器的绿线",
                enumNotificationType.error
            );
            return false;
        }

        let curGreen = initGreen;
        let curOrigine = curGreen.components.StaticMapEntity.origin;
        let outRot = curGreen.components.StaticMapEntity.rotation;
        let node = this.root.knot.createNodeFromEntity(curGreen, "green", outRot, false);
        this.greenNodes.push(node);
        for (;;) {
            let nextOrigin;
            switch (outRot) {
                case 0:
                    nextOrigin = new Vector(curOrigine.x, curOrigine.y - 1);
                    break;
                case 90:
                    nextOrigin = new Vector(curOrigine.x + 1, curOrigine.y);
                    break;
                case 180:
                    nextOrigin = new Vector(curOrigine.x, curOrigine.y + 1);
                    break;
                case 270:
                    nextOrigin = new Vector(curOrigine.x - 1, curOrigine.y);
                    break;
            }
            let nextGreen = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "wires");
            if (!nextGreen) {
                this.root.hud.signals.notification.dispatch("绿线有开放端点", enumNotificationType.error);
                return false;
            }
            if (nextGreen.components.StaticMapEntity.code === 39) {
                // 到达终点 sep
                return true;
            }
            if (nextGreen.components.StaticMapEntity.code === 27) {
                // 通常绿线
                nextGreen.components.StaticMapEntity.rotation = outRot;
                if (!this.root.map.checkNeighborsNull(nextGreen, "wires")) {
                    this.root.hud.signals.notification.dispatch(
                        "绿线 lines 过密",
                        enumNotificationType.error
                    );
                    return false;
                }
                let belowEnt = this.root.map.getLayerContentXY(
                    nextGreen.components.StaticMapEntity.origin.x,
                    nextGreen.components.StaticMapEntity.origin.y,
                    "regular"
                ); // 获取下方 belt, 应当为 null 或横截.
                let bCross = false;
                if (belowEnt) {
                    bCross = true;
                    if (belowEnt.components.StaticMapEntity.code !== 1) {
                        this.root.hud.signals.notification.dispatch(
                            "绿线 lines 与下层位置矛盾",
                            enumNotificationType.error
                        );
                        return false;
                    }
                    if (
                        (belowEnt.components.StaticMapEntity.rotation -
                            nextGreen.components.StaticMapEntity.rotation) %
                            180 ===
                        0
                    ) {
                        this.root.hud.signals.notification.dispatch(
                            "绿线 lines 下方错误",
                            enumNotificationType.error
                        );
                        return false;
                    }
                }

                if (!this.root.map.checkNeighborsNull(nextGreen, "regular")) {
                    let belowEnt = this.root.map.getLayerContentXY(
                        nextGreen.components.StaticMapEntity.origin.x,
                        nextGreen.components.StaticMapEntity.origin.y,
                        "regular"
                    ); // 获取下方 belt, 应当横截.
                    if (!belowEnt) {
                        if (!this.root.map.checkNeighborsNull(nextGreen, "wires")) {
                            this.root.hud.signals.notification.dispatch(
                                "绿线 lines 与下层位置矛盾",
                                enumNotificationType.error
                            );
                            return false;
                        }
                    }
                }
                let node = this.root.knot.createNodeFromEntity(nextGreen, "green", outRot, bCross);
                this.greenNodes.push(node);
            } else if (nextGreen.components.StaticMapEntity.code === 28) {
                // 转角绿线
                if (
                    !this.root.map.checkDiagonalEntities(
                        nextGreen.components.StaticMapEntity.origin,
                        "wire"
                    ) ||
                    !this.root.map.checkDiagonalEntities(
                        nextGreen.components.StaticMapEntity.origin,
                        "regular"
                    )
                ) {
                    // 过密位置非法
                    this.root.hud.signals.notification.dispatch(
                        "绿线 corner 过密",
                        enumNotificationType.error
                    );
                    return false;
                }
                if (nextGreen.components.StaticMapEntity.rotation === outRot) {
                    outRot = (outRot + 90) % 360;
                } else if (nextGreen.components.StaticMapEntity.rotation === (outRot + 90) % 360) {
                    outRot = (outRot + 270) % 360;
                } else {
                    this.root.hud.signals.notification.dispatch(
                        "绿线 corner 错误",
                        enumNotificationType.error
                    );
                    return false;
                }
                let node = this.root.knot.createNodeFromEntity(
                    nextGreen,
                    "green",
                    curGreen.components.StaticMapEntity.rotation,
                    false
                );
                this.greenNodes.push(node);
            } else {
                this.root.hud.signals.notification.dispatch("非法上层建筑", enumNotificationType.error);
                return false;
            }
            curGreen = nextGreen;
            curOrigine = curGreen.components.StaticMapEntity.origin;
        }
    }

    /**
     *
     * @param {Strand[]} check_result_crossings
     * @param {Strand} strand
     * @returns {Strand}
     */
    get_strand_from_array(check_result_crossings, strand) {
        for (let s of check_result_crossings) {
            if (s.node.origin.equals(strand.node.origin) && s.rot === strand.rot) {
                return s;
            }
        }
        return null;
    }

    /**
     *
     * @param {Node[]} red_path
     * @param {Node[]} green_path
     * @param {String} direction
     * @returns {boolean}
     */
    do_check(red_path, green_path, direction) {
        let red_boundary_crossings = [];
        let to_check_set = [];
        let check_result_crossings = [];
        let green_crossing_strands = [];

        let good_path = true;

        for (let g of this.greenNodes) {
            if (g.isCrossing) {
                let rot;
                if (direction == "left") {
                    rot = (g.outRotation + 90) % 360;
                } else {
                    rot = (g.outRotation + 270) % 360;
                }
                green_crossing_strands.push(new Strand(this.root.knot, g, rot, g.crosType));

                if (g.crosType !== "") {
                    let strand;
                    check_result_crossings.push(
                        (strand = new Strand(this.root.knot, g, (rot + 180) % 360, g.crosType))
                    );
                    to_check_set.push(strand);
                }
            }
        }

        for (let r of red_path) {
            if (r.isCrossing) {
                red_boundary_crossings.push(r);
            }
        }

        for (let c of red_boundary_crossings) {
            let rDir;
            if (this.redBlackSameDirection) {
                rDir = c.outRotation;
            } else {
                rDir = (c.outRotation + 180) % 360;
            }
            let strand;
            if (direction === "left") {
                // 检查从左侧进入圆盘红色边界
                to_check_set.push((strand = new Strand(this.root.knot, c, (rDir + 90) % 360, c.crosType)));
            } else {
                // 检查从右侧进入圆盘红色边界
                to_check_set.push((strand = new Strand(this.root.knot, c, (rDir + 270) % 360, c.crosType)));
            }
            check_result_crossings.push(strand);
        }

        while (to_check_set.length) {
            let cross_strand = to_check_set.pop();
            for (;;) {
                let r = this.get_strand_from_array(check_result_crossings, cross_strand.opposite());
                if (r && r.crosType !== "" && r.crosType !== cross_strand.crosType) {
                    good_path = false;
                    break;
                }
                r = this.get_strand_from_array(green_crossing_strands, cross_strand);
                if (r) {
                    r.crosType = cross_strand.crosType;
                    break;
                }
                r = cross_strand.opposite();
                r.crosType = cross_strand.crosType;
                if (!this.get_strand_from_array(check_result_crossings, r)) {
                    check_result_crossings.push(r);
                }
                r = this.get_strand_from_array(to_check_set, cross_strand.opposite());
                if (r) {
                    to_check_set.splice(to_check_set.indexOf(r), 1);
                }

                let b = false;
                for (let c of red_boundary_crossings) {
                    if (c.origin.equals(cross_strand.opposite().node.origin)) {
                        b = true;
                        if (c.crosType !== cross_strand.crosType) {
                            good_path = false;
                        }
                        break;
                    }
                }
                if (b) {
                    break;
                }

                if (
                    cross_strand.opposite().node.origin.equals(this.seperators[0]) ||
                    cross_strand.opposite().node.origin.equals(this.seperators[1])
                ) {
                    break;
                }

                let oppo = cross_strand.opposite();
                oppo.crosType = cross_strand.crosType;
                if (oppo.node.isCrossing) {
                    // 下一个是内部交点
                    let sideStrand1 = new Strand(this.root.knot, oppo.node, (oppo.rot + 90) % 360, "");
                    let sideStrand2 = new Strand(this.root.knot, oppo.node, (oppo.rot + 270) % 360, "");
                    if (oppo.node.crosType === "over" && oppo.crosType === "under") {
                        r = this.get_strand_from_array(check_result_crossings, sideStrand1);
                        if (r && r.crosType === "over") {
                            good_path = false;
                            break;
                        } else if (!r) {
                            sideStrand1.crosType = "under";
                            check_result_crossings.push(sideStrand1);
                            to_check_set.push(sideStrand1);
                        }
                        r = this.get_strand_from_array(check_result_crossings, sideStrand2);
                        if (r && r.crosType === "over") {
                            good_path = false;
                            break;
                        } else if (!r) {
                            sideStrand2.crosType = "under";
                            check_result_crossings.push(sideStrand2);
                            to_check_set.push(sideStrand2);
                        }
                    }

                    if (oppo.node.crosType === "under" && oppo.crosType === "over") {
                        r = this.get_strand_from_array(check_result_crossings, sideStrand1);
                        if (r && r.crosType === "under") {
                            good_path = false;
                            break;
                        } else if (!r) {
                            sideStrand1.crosType = "over";
                            check_result_crossings.push(sideStrand1);
                            to_check_set.push(sideStrand1);
                        }
                        r = this.get_strand_from_array(check_result_crossings, sideStrand2);
                        if (r && r.crosType === "under") {
                            good_path = false;
                            break;
                        } else if (!r) {
                            sideStrand2.crosType = "over";
                            check_result_crossings.push(sideStrand2);
                            to_check_set.push(sideStrand2);
                        }
                    }
                }
                let nStrand = cross_strand.next();
                nStrand.crosType = cross_strand.crosType;
                //console.log(nStrand.node.origin);
                r = this.get_strand_from_array(check_result_crossings, nStrand);
                if (!r) {
                    nStrand.crosType = cross_strand.crosType;
                    check_result_crossings.push(nStrand);
                }
                cross_strand = nStrand;
            }
            if (!good_path) {
                break;
            }
        }
        if (!good_path) {
            return false;
        }

        // 在 this.greenNodes 中返回 crosType
        for (let gS of green_crossing_strands) {
            for (let gN of this.greenNodes) {
                if (gN.origin.equals(gS.node.origin)) {
                    gN.crosType = gS.crosType;
                    break;
                }
            }
        }

        return good_path;
    }

    recoverHiddenLines() {
        for (let entity of this.hiddenNodes) {
            this.root.logic.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
        }
        this.hiddenNodes = [];
    }

    reDrawGreenLine() {
        // 删除目前显示绿线
        let green_entities = [];
        for (let ent of this.root.entityMgr.entities) {
            if (
                ent.layer === "wires" &&
                (ent.components.StaticMapEntity.code === 27 || ent.components.StaticMapEntity.code === 28)
            ) {
                // 绿线
                green_entities.push(ent);
            }
        }

        for (let de of green_entities) {
            this.root.logic.tryDeleteBuilding(de);
        }
        // 恢复被切断的下层路径
        this.recoverHiddenLines();

        // 重绘绿线
        let prevRot = 0;
        for (let curNode of this.greenNodes) {
            let _building = new MetaWireBuilding();

            let rotVar;
            let rot;
            if (curNode.isCorner) {
                rotVar = 1;
                if (curNode.outRotation === (prevRot + 90) % 360) {
                    rot = prevRot;
                } else {
                    rot = (prevRot + 90) % 360;
                }
            } else {
                rotVar = 0;
                rot = curNode.outRotation;
            }

            let entity = _building.createEntity({
                root: this.root,
                origin: curNode.origin,
                rotation: rot,
                originalRotation: curNode.outRotation,
                rotationVariant: rotVar,
                variant: "default",
            });

            if (curNode.crosType === "over") {
                this.hiddenNodes.push(entity.clone());
                let gEnt = this.root.map.getLayerContentXY(
                    entity.components.StaticMapEntity.origin.x,
                    entity.components.StaticMapEntity.origin.y,
                    "wires"
                );
                if (gEnt) {
                    this.root.logic.tryDeleteBuilding(gEnt);
                }
                continue;
            }

            let belowEnt = this.root.map.getLayerContentXY(
                entity.components.StaticMapEntity.origin.x,
                entity.components.StaticMapEntity.origin.y,
                "regular"
            );
            if (belowEnt) {
                this.hiddenNodes.push(belowEnt.clone());
                this.root.logic.tryDeleteBuilding(belowEnt);
            }

            this.root.logic.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
            prevRot = curNode.outRotation;
        }
    }

    deleteRedLineBelow() {
        let toDel = [];
        for (let ent of this.root.entityMgr.entities) {
            if (
                ent.layer === "wires" &&
                (ent.components.StaticMapEntity.code === 52 || ent.components.StaticMapEntity.code === 53)
            ) {
                // 红线
                let belowEnt = this.root.map.getLayerContentXY(
                    ent.components.StaticMapEntity.origin.x,
                    ent.components.StaticMapEntity.origin.y,
                    "regular"
                );
                if (ent) {
                    toDel.push(belowEnt);
                    toDel.push(ent);
                }
            }
        }

        for (let de of toDel) {
            this.root.logic.tryDeleteBuilding(de);
        }
        if (this.redBlackSameDirection) {
            for (let r of this.redPathForward) {
                if (r.isCrossing && r.crosType === "under") {
                    let _building = new MetaBeltBuilding();
                    let rot;
                    let e;
                    if (r.outRotation % 180 == 0) {
                        e = this.root.map.getLayerContentXY(r.origin.x + 1, r.origin.y, "regular");
                    } else {
                        e = this.root.map.getLayerContentXY(r.origin.x, r.origin.y + 1, "regular");
                    }
                    rot = e.components.StaticMapEntity.rotation;
                    let entity = _building.createEntity({
                        root: this.root,
                        origin: r.origin,
                        rotation: rot,
                        originalRotation: rot,
                        rotationVariant: 0,
                        variant: "default",
                    });
                    this.root.logic.freeEntityAreaBeforeBuild(entity);
                    this.root.map.placeStaticEntity(entity);
                    this.root.entityMgr.registerEntity(entity);
                }
            }
        } else {
            for (let r of this.redPathReverse) {
                if (r.isCrossing && r.crosType === "under") {
                    let _building = new MetaBeltBuilding();
                    let rot;
                    let e;
                    if (r.outRotation % 180 == 0) {
                        e = this.root.map.getLayerContentXY(r.origin.x + 1, r.origin.y, "regular");
                    } else {
                        e = this.root.map.getLayerContentXY(r.origin.x, r.origin.y + 1, "regular");
                    }
                    rot = e.components.StaticMapEntity.rotation;
                    let entity = _building.createEntity({
                        root: this.root,
                        origin: r.origin,
                        rotation: rot,
                        originalRotation: rot,
                        rotationVariant: 0,
                        variant: "default",
                    });
                    this.root.logic.freeEntityAreaBeforeBuild(entity);
                    this.root.map.placeStaticEntity(entity);
                    this.root.entityMgr.registerEntity(entity);
                }
            }
        }
    }

    drawGreenLineBelow() {
        let toDel = [];
        for (let ent of this.root.entityMgr.entities) {
            if (
                ent.layer === "wires" &&
                (ent.components.StaticMapEntity.code === 27 || ent.components.StaticMapEntity.code === 28)
            ) {
                // 绿线
                let belowEnt = this.root.map.getLayerContentXY(
                    ent.components.StaticMapEntity.origin.x,
                    ent.components.StaticMapEntity.origin.y,
                    "regular"
                );
                if (ent) {
                    toDel.push(ent);
                }
            }
        }
        for (let de of toDel) {
            this.root.logic.tryDeleteBuilding(de);
        }
        let reverseDelta = 0;
        if (!this.redBlackSameDirection) {
            reverseDelta = 180;
        }
        for (let g of this.greenNodes) {
            if (g.crosType === "over") {
                continue;
            }
            let _building = new MetaBeltBuilding();
            let rot = (g.outRotation + reverseDelta) % 360;
            let oriRot = (g.outRotation + reverseDelta) % 360;
            let rotVar = 0;
            let entity;

            if (g.isCorner) {
                let inRot, outRot;
                if (reverseDelta) {
                    inRot =
                        (this.greenNodes[(this.greenNodes.indexOf(g) + 1) % this.greenNodes.length]
                            .outRotation +
                            reverseDelta) %
                        360;
                    outRot =
                        (this.greenNodes[(this.greenNodes.indexOf(g) - 1) % this.greenNodes.length]
                            .outRotation +
                            reverseDelta) %
                        360;
                } else {
                    inRot = this.greenNodes[(this.greenNodes.indexOf(g) - 1) % this.greenNodes.length]
                        .outRotation;
                    outRot = this.greenNodes[(this.greenNodes.indexOf(g) + 1) % this.greenNodes.length]
                        .outRotation;
                }

                if ((outRot - inRot + 360) % 360 === 270) {
                    rotVar = 1;
                } else {
                    rotVar = 2;
                }
                rot = inRot;
            }
            entity = _building.createEntity({
                root: this.root,
                origin: g.origin,
                rotation: rot,
                originalRotation: oriRot,
                rotationVariant: rotVar,
                variant: "default",
            });
            this.root.logic.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
        }
    }

    /**
     * @param {Node[]} red_path
     */
    drawSepratorBelow(red_path) {
        for (let sep of this.seperators) {
            let sep_node;
            for (sep_node of this.root.knot.nodes) {
                if (sep_node.origin.equals(sep)) {
                    break;
                }
            }

            let neighbors = [];
            neighbors.push(new Vector(sep.x, sep.y - 1));
            neighbors.push(new Vector(sep.x + 1, sep.y));
            neighbors.push(new Vector(sep.x, sep.y + 1));
            neighbors.push(new Vector(sep.x - 1, sep.y));

            let redOri, greenOri;
            if (red_path.length) {
                for (let nei of neighbors) {
                    for (let r of red_path) {
                        if (r.origin.equals(nei)) {
                            redOri = nei;
                            break;
                        }
                    }
                }
            } else {
                return;
            }
            for (let nei of neighbors) {
                for (let g of this.greenNodes) {
                    if (g.origin.equals(nei)) {
                        greenOri = nei;
                        break;
                    }
                }
            }

            let outOri = neighbors[sep_node.outRotation / 90];
            let inRot, outRot;
            if (outOri === redOri) {
                inRot = this.root.map.getLayerContentXY(sep.x, sep.y, "regular").components.StaticMapEntity
                    .rotation;
                outRot = neighbors.indexOf(greenOri) * 90;
            } else {
                outRot = neighbors.indexOf(outOri) * 90;
                inRot = neighbors.indexOf(greenOri) * 90;
                inRot = (inRot + 180) % 360;
            }

            let entity, rot, oriRot, rotVar;
            rot = inRot;
            if (inRot !== outRot) {
                if ((outRot - inRot + 360) % 360 === 270) {
                    rotVar = 1;
                } else {
                    rotVar = 2;
                }
            } else {
                rot = oriRot = inRot;
                rotVar = 0;
            }

            let _building = new MetaBeltBuilding();
            entity = _building.createEntity({
                root: this.root,
                origin: sep,
                rotation: rot,
                originalRotation: oriRot,
                rotationVariant: rotVar,
                variant: "default",
            });
            this.root.logic.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
        }

        let sep_entities = [];
        for (let ent of this.root.entityMgr.entities) {
            if (ent.layer === "wires" && ent.components.StaticMapEntity.code === 39) {
                // sep
                sep_entities.push(ent);
            }
        }

        for (let de of sep_entities) {
            if (!de.destroyed) {
                this.root.logic.tryDeleteBuilding(de);
            }
        }
    }

    /**
     * @param {Node[]} redPath
     * @param {boolean} bForward
     */
    showRedLine(redPath, bForward) {
        this.deleteRedLine();
        // 绘制红线
        let prevRot = -1; // 在循环中会被第一次设置为合理值
        for (let curNode of redPath) {
            let _building = new MetaWireBuilding();

            let rotVar;
            let rot;
            if (curNode.isCorner) {
                rotVar = 1;
                if (bForward) {
                    if (curNode.outRotation === (prevRot + 90) % 360) {
                        rot = prevRot;
                    } else {
                        rot = (prevRot + 90) % 360;
                    }
                } else {
                    let i = redPath.indexOf(curNode);
                    let nextRot = redPath[(i + 1) % redPath.length].outRotation;
                    if (curNode.outRotation === (nextRot + 270) % 360) {
                        rot = (curNode.outRotation + 180) % 360;
                    } else {
                        rot = (curNode.outRotation + 270) % 360;
                    }
                }
            } else {
                rotVar = 0;
                if (bForward) {
                    rot = curNode.outRotation;
                } else {
                    rot = (curNode.outRotation + 180) % 360;
                }
            }

            if (curNode.crosType === "over") {
                continue;
            }

            let entity = _building.createEntity({
                root: this.root,
                origin: curNode.origin,
                rotation: rot,
                originalRotation: curNode.outRotation,
                rotationVariant: rotVar,
                variant: "second",
            });

            this.root.logic.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
            prevRot = curNode.outRotation;
        }
    }

    moveGreenLine() {
        if (this.readyToMove) {
            this.root.systemMgr.systems.wire.bUpdateSuround = false;
            this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
            // 已经合规, 第二阶段的 move knot
            this.deleteRedLineBelow();
            this.drawGreenLineBelow();
            this.drawSepratorBelow(
                this.check_result_array[
                    (this.checkResultIndex + this.check_result_array.length - 1) %
                        this.check_result_array.length
                ].rPath
            );
            this.root.systemMgr.systems.wire.bUpdateSuround = true;
            //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
            this.root.knot.rebuild();
            this.rebuild();
            this.root.hud.signals.notification.dispatch(
                "新扭结 crossings: " + this.root.knot.crossings.length,
                enumNotificationType.success
            );
            this.root.systemMgr.systems.wire.bUpdateSuround = true;
            return;
        } else {
            this.root.hud.signals.notification.dispatch("请先选择合适红绿线位置", enumNotificationType.error);
        }
        return;
    }

    /**
     *
     * @param {Node[]} nodesArr
     * @returns {Node[]}
     */
    cloneNodesArray(nodesArr) {
        let res = [];
        for (let n of nodesArr) {
            res.push(n.clone());
        }
        return res;
    }

    /**
     *
     * @param {Node[]} nodesArr
     * @returns {boolean}
     */
    isNodesArrayNotExist(nodesArr, r_path) {
        for (let r of this.check_result_array) {
            if (JSON.stringify(r.gNodes) === JSON.stringify(nodesArr) && r.rPath === r_path) {
                return false;
            }
        }
        return true;
    }

    checkGreenLineDirection(red_path_array, dir) {
        for (let ent of red_path_array) {
            let r_path = ent.path;
            let bSameDir = ent.dir;

            let greenUnknownCrossing = [];
            for (let gN of this.greenNodes) {
                gN.crosType = "";
            }

            if (r_path.length && this.do_check(r_path, this.greenNodes, dir)) {
                for (let gN of this.greenNodes) {
                    if (gN.isCrossing && gN.crosType === "") {
                        greenUnknownCrossing.push(gN);
                    }
                }

                if (greenUnknownCrossing.length) {
                    // 存在未定交点类型
                    if (greenUnknownCrossing.length > 10) {
                        this.root.hud.signals.notification.dispatch(
                            "未定交点过多, 将随机布置",
                            enumNotificationType.warning
                        );
                        let newNodesArr = this.cloneNodesArray(this.greenNodes);
                        if (this.isNodesArrayNotExist(newNodesArr, r_path)) {
                            this.check_result_array.push({
                                gNodes: this.cloneNodesArray(this.greenNodes),
                                rPath: r_path,
                                rPathDir: bSameDir,
                            });
                        }
                    } else {
                        for (let rand = 0; rand < 2 ** greenUnknownCrossing.length; rand++) {
                            for (let i = 0; i < greenUnknownCrossing.length; i++) {
                                greenUnknownCrossing[i].crosType = (rand >> i) % 2 ? "under" : "over";
                            }
                            if (r_path.length && this.do_check(r_path, this.greenNodes, dir)) {
                                let newNodesArr = this.cloneNodesArray(this.greenNodes);
                                if (this.isNodesArrayNotExist(newNodesArr, r_path)) {
                                    this.check_result_array.push({
                                        gNodes: this.cloneNodesArray(this.greenNodes),
                                        rPath: r_path,
                                        rPathDir: bSameDir,
                                    });
                                }
                            }
                        }
                    }
                } else {
                    let newNodesArr = this.cloneNodesArray(this.greenNodes);
                    if (this.isNodesArrayNotExist(newNodesArr, r_path)) {
                        this.check_result_array.push({
                            gNodes: this.cloneNodesArray(this.greenNodes),
                            rPath: r_path,
                            rPathDir: bSameDir,
                        });
                    }
                }
            }
        }
    }

    checkGreenLine() {
        if (!this.check_result_array.length) {
            if (this.seperators.length !== 2) {
                this.root.hud.signals.notification.dispatch(
                    "请先设置 2 个分离器",
                    enumNotificationType.error
                );
                return;
            }

            // do check
            this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
            this.root.systemMgr.systems.wire.bUpdateSuround = false;
            if (!this.reDirectionGreenLine()) {
                this.root.systemMgr.systems.wire.bUpdateSuround = true;
                return;
            }

            //this.root.hud.signals.notification.dispatch("绿线合规!", enumNotificationType.success);
            this.redPathForward.length = this.redPathReverse.length = 0;
            // 关闭道路自适应
            this.root.systemMgr.systems.wire.bUpdateSuround = false;
            this.initRedPath(true, this.redPathForward);
            this.initRedPath(false, this.redPathReverse);
            this.redPathReverse = this.redPathReverse.reverse();
            // 打开道路自适应
            //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;

            this.check_result_array = [];

            let red_path_array = [];
            let red_path = [];
            if (this.redPathForward.length) {
                red_path = this.redPathForward;
                red_path_array.push({ path: red_path, dir: true });
                this.redBlackSameDirection = true;
            }
            if (this.redPathReverse.length) {
                red_path = this.redPathReverse;
                red_path_array.push({ path: red_path, dir: false });
                this.redBlackSameDirection = false;
            }

            //console.log("==================================== check left =================================");
            this.checkGreenLineDirection(red_path_array, "left");
            //console.log("==================================== check right =================================");
            this.checkGreenLineDirection(red_path_array, "right");
        }

        if (this.check_result_array.length) {
            this.root.systemMgr.systems.wire.bUpdateSuround = false;
            this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
            this.showRedLine(
                this.check_result_array[this.checkResultIndex].rPath,
                this.check_result_array[this.checkResultIndex].rPathDir
            );
            this.greenNodes = this.check_result_array[this.checkResultIndex].gNodes;
            this.redBlackSameDirection = this.check_result_array[this.checkResultIndex].rPathDir;
            this.reDrawGreenLine();
            //this.root.systemMgr.systems.wire.bUpdateSuround = true;
            //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
            this.readyToMove = true;

            this.root.hud.signals.notification.dispatch(
                "发现移动位置 " + (this.checkResultIndex + 1) + "/" + this.check_result_array.length,
                enumNotificationType.success
            );
            this.checkResultIndex = (this.checkResultIndex + 1) % this.check_result_array.length;
            return;
        }

        this.root.hud.signals.notification.dispatch("没找到合法红线", enumNotificationType.error);
        return;
    }
}
