import { Vector } from "../core/vector";
import { MetaWireBuilding } from "./buildings/wire";
import { enumNotificationType } from "./hud/parts/notifications";
import { GameRoot } from "./root";


export class Node {
        /**
         * 
         * @param {Vector} origin 
         */
        constructor(origin) {
               this.origin = origin;
               this.color = "black";
               this.isCrossing = false;
               this.outRotation = 0;
               this.isCorner = false; 
        }
}


export class Knot {

        /**
         * 
         * @param {GameRoot} root 
         */
        constructor(root) {
                this.unLeagleMessage = "";
                this.root = root;
                this.nodes = [];        // 按扭结序的各坐标点, 构造后可直接遍历, 相当于沿扭结 travel
                this.greenNodes = [];   // 绿线上的节点
                this.crossings = [];
                this.corners = [];
                this.seperators = [];
                this.greenLineOK = false;

                this.redPathForward = [];
                this.redPathReverse = [];
                //this.greenCrossings = [];

                let reg_entities = []
                for (let ent of this.root.entityMgr.entities) {
                        if (ent.layer === "regular") {
                                reg_entities.push(ent)
                        } else if (ent.layer === "wires" && ent.components.StaticMapEntity.code === 39) { // seprator
                                this.seperators.push(ent.components.StaticMapEntity.origin)
                        }
                }
                // 检查 regular 层的 belt 是否构成合法扭结
                let initEntity = reg_entities[0];
                if (!initEntity) {
                        this.clear("请先绘制扭结");
                        return;
                }

                if (initEntity.components.StaticMapEntity.code < 1 || initEntity.components.StaticMapEntity.code > 3) {
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
                let node = this.createNodeFromEntity(curEntity, "black", curEntity.components.StaticMapEntity.rotation, false);
                this.nodes.push(node);

                // 这种 travel along knot 的做法多次用到, logic.js 中的 定向整理 也用到, 或许可以整理一个 travel 函数, 传入回调
                while (true) {
                        let nextOrigin = this.root.map.getNextOrigin(curEntity);
                        let nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                        if (nextEntity === initEntity){
                                break;
                        }
                        if (!nextEntity) {
                                // 未完整闭合
                                this.clear("未完整闭合");
                                return;
                        }
                        if (passedEntities.indexOf(nextEntity) > 0 && !this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)) {
                                // 通常点二次到达
                                this.clear("定向整理错误");
                                return;
                        }
                        if (passedEntities.indexOf(nextEntity) !== passedEntities.lastIndexOf(nextEntity) && this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)) {// crossing 已经经过两次以上
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
                                let node = this.createNodeFromEntity(nextEntity, "black", curEntity.components.StaticMapEntity.rotation, true);
                                this.nodes.push(node);
                                // 这是一个交点, 需要去寻找下一个位置
                                let curOrigine = curEntity.components.StaticMapEntity.origin;
                                nextOrigin.x = 2 * nextOrigin.x - curOrigine.x;
                                nextOrigin.y = 2 * nextOrigin.y - curOrigine.y;
                                nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                                node = this.createNodeFromEntity(nextEntity, "black", nextEntity.components.StaticMapEntity.rotation, false);
                                this.nodes.push(node);
                        } else if (nextEntity.components.StaticMapEntity.code === 2 || nextEntity.components.StaticMapEntity.code === 3) {
                                //是 corner
                                this.corners.push(nextEntity);
                                let node = this.createNodeFromEntity(nextEntity, "black", nextEntity.components.StaticMapEntity.rotation, false);
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
                                let node = this.createNodeFromEntity(nextEntity, "black", nextEntity.components.StaticMapEntity.rotation, false);
                                this.nodes.push(node);
                        }
                        curEntity = nextEntity;
                        mapBeltCount++;
                }

                if (mapBeltCount + 1 !== reg_entities.length) {
                        // 有多余 tile
                        this.clear("有多余 tile")
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
                return ""
        }

        /**
         * 
         * @param { import("../savegame/savegame_typedefs").Entity } entity 
         * @param { String } color 
         * @param { number } inRot 
         * @param { boolean } isCrossing
         * @returns 
         */
        createNodeFromEntity(entity, color, inRot, isCrossing){
                let node = new Node(entity.components.StaticMapEntity.origin);
                node.color = color;
                if (color === "black"){
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
                                        node.outRotation  = (inRot + 270) % 360;
                                } else {
                                        return null;
                                }
                        } else {
                                node.outRotation = inRot;
                        }
                        return node;
                }
                return null;
        }
        /**
         * 重整绿线的定向, 为后面确定穿越圆盘的左右做准备
         * @returns {boolean}
         */
        reDirectionGreenLine() {
                this.greenNodes = []
                //this.greenCrossings = []
                let startSep = this.seperators[0];
                let belowBelt = this.root.map.getLayerContentXY(startSep.x, startSep.y, "regular");
                let initGreen;
                if (belowBelt.components.StaticMapEntity.rotation % 180 === 0) { // 底层 belt 上下
                        let left = this.root.map.getLayerContentXY(startSep.x - 1, startSep.y, "wires");
                        let right = this.root.map.getLayerContentXY(startSep.x + 1, startSep.y, "wires");
                        if ((left && right) || (!left && !right)) {
                                this.root.hud.signals.notification.dispatch("同一分离器上的绿线非法", enumNotificationType.error);
                                return false;
                        }
                        initGreen = left ? left : right;
                        initGreen.components.StaticMapEntity.rotation = left ? 270 : 90;



                } else {
                        let top = this.root.map.getLayerContentXY(startSep.x, startSep.y - 1, "wires");
                        let bottom = this.root.map.getLayerContentXY(startSep.x, startSep.y + 1, "wires");
                        if ((top && bottom) || (!top && !bottom)) {
                                this.root.hud.signals.notification.dispatch("同一分离器上的绿线非法", enumNotificationType.error);
                                return false;
                        }
                        initGreen = top ? top : bottom;
                        initGreen.components.StaticMapEntity.rotation = top ? 0 : 180;
                }
                let curGreen = initGreen;
                let curOrigine = curGreen.components.StaticMapEntity.origin;
                let outRot = curGreen.components.StaticMapEntity.rotation;
                let node = this.createNodeFromEntity(curGreen, "green", outRot, false);
                this.greenNodes.push(node);
                while (true) {
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
                        if (nextGreen.components.StaticMapEntity.code === 39){ // 到达终点 sep
                                return true;
                        }
                        if (nextGreen.components.StaticMapEntity.code === 27){ // 通常绿线
                                nextGreen.components.StaticMapEntity.rotation = outRot;
                                if (!this.root.map.checkNeighborsNull(nextGreen, "wires")) {
                                        this.root.hud.signals.notification.dispatch("绿线 lines 过密", enumNotificationType.error);
                                        return false; 
                                }
                                let belowEnt = this.root.map.getLayerContentXY(nextGreen.components.StaticMapEntity.origin.x, nextGreen.components.StaticMapEntity.origin.y, "regular"); // 获取下方 belt, 应当为 null 或横截.
                                if (belowEnt) {
                                        if (belowEnt.components.StaticMapEntity.code !== 1) {
                                                this.root.hud.signals.notification.dispatch("绿线 lines 与下层位置矛盾", enumNotificationType.error);
                                                return false;
                                        }
                                        if ((belowEnt.components.StaticMapEntity.rotation - nextGreen.components.StaticMapEntity.rotation) % 180 === 0){
                                                this.root.hud.signals.notification.dispatch("绿线 lines 下方错误", enumNotificationType.error);
                                                return false;
                                        }
                                        
                                }
                                
                                if (!this.root.map.checkNeighborsNull(nextGreen, "regular")) {
                                        let belowEnt = this.root.map.getLayerContentXY(nextGreen.components.StaticMapEntity.origin.x, nextGreen.components.StaticMapEntity.origin.y, "regular"); // 获取下方 belt, 应当横截.
                                        if (!belowEnt) {
                                                if (!this.root.map.checkNeighborsNull(nextGreen, "wires")) {
                                                        this.root.hud.signals.notification.dispatch("绿线 lines 与下层位置矛盾", enumNotificationType.error);
                                                        return false;
                                                }
                                        }
                                }
                                let node = this.createNodeFromEntity(nextGreen, "green", outRot, false);
                                this.greenNodes.push(node);
                        } else if (nextGreen.components.StaticMapEntity.code === 28){ // 转角绿线
                                if (!this.root.map.checkDiagonalEntities(nextGreen.components.StaticMapEntity.origin, "wire")) {
                                        // 过密位置非法
                                        this.root.hud.signals.notification.dispatch("绿线 corner 过密", enumNotificationType.error);
                                        return false ;
                                }
                                if (nextGreen.components.StaticMapEntity.rotation === outRot){
                                        outRot = (outRot + 90) % 360;
                                } else if (nextGreen.components.StaticMapEntity.rotation === (outRot + 90) % 360){
                                        outRot = (outRot + 270) % 360;
                                } else {
                                        this.root.hud.signals.notification.dispatch("绿线 corner 错误", enumNotificationType.error);
                                                return false; 
                                }
                                let node = this.createNodeFromEntity(nextGreen, "green", curGreen.components.StaticMapEntity.rotation, false);
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
         * @param {Vector} origin 
         * @returns {number}
         */
        getBeltNodeIndex(origin){
                for (let n of this.nodes){
                        if (n.origin.x === origin.x && n.origin.y === origin.y){
                                return this.nodes.indexOf(n);
                        }
                }
                return Infinity;
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
                if (this.root.map.isCrossingEntity(new Vector(origin.x - 1, origin.y)) ||
                        this.root.map.isCrossingEntity(new Vector(origin.x + 1, origin.y)) ||
                        this.root.map.isCrossingEntity(new Vector(origin.x, origin.y - 1)) ||
                        this.root.map.isCrossingEntity(new Vector(origin.x, origin.y + 1))) {
                        this.root.hud.signals.notification.dispatch("不能离交点太近", enumNotificationType.error);
                        return true;
                }
                if (this.root.map.isCornerEntity(new Vector(origin.x - 1, origin.y)) ||
                        this.root.map.isCornerEntity(new Vector(origin.x + 1, origin.y)) ||
                        this.root.map.isCornerEntity(new Vector(origin.x, origin.y - 1)) ||
                        this.root.map.isCornerEntity(new Vector(origin.x, origin.y + 1))) {
                        this.root.hud.signals.notification.dispatch("不能离 corner 太近 (可以设置在 corner 上)", enumNotificationType.error);
                        return true;
                }
                if (this.root.knot.seperators.length > 2) {
                        this.root.hud.signals.notification.dispatch("只能设置两个分割点", enumNotificationType.error);
                        return true;
                }
                // this.root.knot.seperators.push(origin);
                return false;
        }

        /**
         * 
         * @param {boolean} bForward 
         * @param {any[]} redPath 
         */
        initRedPathForward(bForward, redPath){
                let startOrigin;
                let endOrigine;
                if (bForward) {
                        startOrigin = this.seperators[0];
                        endOrigine = this.seperators[1];
                } else {
                        startOrigin = this.seperators[1];
                        endOrigine = this.seperators[0];
                }


                let initIndex = (this.getBeltNodeIndex(startOrigin) + 1) % this.nodes.length;
                let lastIndex = (this.getBeltNodeIndex(endOrigine) + 1) % this.nodes.length;
                let curIndex = initIndex; 
                while (true) {
                        let curNode = this.nodes[curIndex];
                        if ((curIndex + 1)% this.nodes.length === lastIndex) {
                                break
                        }
                        for (let no of redPath){
                                if (no.origin.x === curNode.origin.x && no.origin.y === curNode.origin.y){
                                        // 红线有自交,
                                        redPath.length = 0;
                                        return;
                                }
                        }
                        for (let no of this.greenNodes){
                                if (no.origin.x === curNode.origin.x && no.origin.y === curNode.origin.y){
                                        // 与绿线相交,
                                        redPath.length = 0;
                                        return;
                                }
                        }
                        redPath.push(curNode);
                        
                        curIndex = (curIndex + 1) % this.nodes.length;
                }

                // 绘制红线
                let prevRot;
                for (let curNode of redPath) {
                        let _building = new MetaWireBuilding();

                        let rotVar;
                        let rot;
                        if (curNode.isCorner){
                                rotVar = 1;
                                if (curNode.outRotation === (prevRot + 90) % 360){
                                        rot = prevRot;
                                } else {
                                        rot = (prevRot + 90) % 360;
                                }
                        } else {
                                rotVar = 0;
                                rot = curNode.outRotation
                        }
                        let entity = _building.createEntity({
                                root: this.root,
                                origin: curNode.origin,
                                rotation: rot,
                                originalRotation: curNode.outRotation,
                                rotationVariant: rotVar,
                                variant: "second"
                        });
                        //entity.components.Wire.variant = "second";

                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                        this.root.map.placeStaticEntity(entity);
                        this.root.entityMgr.registerEntity(entity);
                        prevRot = curNode.outRotation;
                }
                
        }
        checkGreenLine() {
                if (this.seperators.length !==2){
                        this.root.hud.signals.notification.dispatch("请先设置 2 个分离器", enumNotificationType.success);
                        return;
                }
                // if (this.greenLineOK ) {
                //         // 已经合规, 第二阶段的 move knot

                //         return;
                // }
                //this.greenLineOK = true;

                // do check
                this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                if (!this.reDirectionGreenLine()) {
                        return;
                }
                this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
                this.root.hud.signals.notification.dispatch("绿线合规!", enumNotificationType.success);
                this.root.systemMgr.systems.wire.bUpdateSuround = false;
                this.initRedPathForward(true, this.redPathForward);
                this.initRedPathForward(false, this.redPathReverse);
                if (this.redPathForward.length === 0 && this.redPathReverse.length === 0){
                        this.root.hud.signals.notification.dispatch("没找到合法红线", enumNotificationType.error);
                }
        }

}