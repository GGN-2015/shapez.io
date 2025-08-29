import { THIRDPARTY_URLS } from "../core/config";
import { getNameOfProvider } from "../core/sensitive_utils.encrypt";
import { Vector } from "../core/vector";
import { MetaBeltBuilding } from "./buildings/belt";
import { MetaWireBuilding } from "./buildings/wire";
import { enumNotificationType } from "./hud/parts/notifications";
import { GameRoot } from "./root";
import { THEME } from "./theme";


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

               this.crosType = "";      // over 表示 black 线在上, under 表示 black 线在下
        }
}

class Strand{   // strand 是指一个 node 加上一个 rotation
        /**
         * @param {Knot} knot
         * @param {Node} node 
         * @param {number} rot 
         * @param {String} type
         */
        constructor(knot, node, rot, type){
                this.knot = knot;
                this.node = node;
                this.rot = rot;
                this.crosType = type;
                
        }

        opposite(){
                for (let i =0; i< this.knot.nodes.length;i++){
                        let node = this.knot.nodes[i];          
                        if (node.origin.equals(this.node.origin) ){//&& (node.outRotation - this.rot) % 180 ===0){
                                if (node.isCorner){
                                        if (node.outRotation === this.rot ){
                                                return new Strand(this.knot, this.knot.nodes[(i+1)%this.knot.nodes.length], (this.rot+180) % 360, ""); 
                                        } else {
                                                return new Strand(this.knot, this.knot.nodes[(i+this.knot.nodes.length-1)%this.knot.nodes.length], (this.rot+180) % 360, "");  
                                        }
                                } else {
                                        if ((node.outRotation - this.rot) % 180 ===0){
                                                let delta = node.outRotation === this.rot ? 1 : this.knot.nodes.length - 1;
                                                return new Strand(this.knot, this.knot.nodes[(i+delta)%this.knot.nodes.length], (this.rot+180) % 360, "");

                                        }
                                }
                        }
                }
                return null;
        }

        next(){
                for (let i =0; i< this.knot.nodes.length;i++){
                        let node = this.knot.nodes[i];
                        if (this.node.isCorner) {
                                if (node.origin.equals(this.node.origin)) {
                                        if (node.outRotation === this.rot) {
                                                return new Strand(this.knot, this.knot.nodes[(i + 1) % this.knot.nodes.length], this.knot.nodes[(i + 1) % this.knot.nodes.length].outRotation, "");
                                        } else {
                                                return new Strand(this.knot, this.knot.nodes[(i + this.knot.nodes.length - 1) % this.knot.nodes.length], this.rot, "");
                                        }
                                }
                        } else if (node.origin.equals(this.node.origin) && (node.outRotation - this.rot) % 180 ===0){
                                let delta = node.outRotation === this.rot ? 1 : this.knot.nodes.length - 1;
                                if (delta === 1){
                                        return new Strand(this.knot, this.knot.nodes[(i+delta)%this.knot.nodes.length], this.knot.nodes[(i+delta)%this.knot.nodes.length].outRotation, "");
                                } else {
                                        return new Strand(this.knot, this.knot.nodes[(i+delta)%this.knot.nodes.length], (this.knot.nodes[(i+delta -1 )%this.knot.nodes.length].outRotation + 180) % 360, "");
                                }
                        }
                }
                return null;
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
                this.constructorEbd();
                
        }

        constructorEbd(){
                /**
                 * @type {Node[]} nodes
                 */
                 this.nodes = [];        // 按扭结序的各坐标点, 构造后可直接遍历, 相当于沿扭结 travel
                 /**
                  * @type {Node[]} greenNodes
                  */
                 this.greenNodes = [];   // 绿线上的节点
                 this.crossings = [];
                 this.corners = [];
                 this.seperators = [];
                 this.greenLineOK = false;
                 
                 this.redBlackSameDirection = true;
                 /**
                  * @type {Node[]} redPathForward
                  */
                 this.redPathForward = [];
                 /**
                  * @type {Node[]} redPathReverse
                  */
                 this.redPathReverse = [];
                 //this.greenCrossings = [];
 
                 let reg_entities = [];
                 let red_entities = [];
                 for (let ent of this.root.entityMgr.entities) {
                         if (ent.layer === "regular") {
                                 reg_entities.push(ent)
                         } else if (ent.layer === "wires" && ent.components.StaticMapEntity.code === 39) { // seprator
                                 this.seperators.push(ent.components.StaticMapEntity.origin)
                         } else if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 52 || ent.components.StaticMapEntity.code === 53)){ // 红线
                                 red_entities.push(ent);
                         }
                 }
 
                 for (let de of red_entities){
                         this.root.logic.tryDeleteBuilding(de);
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
                                 if (nextEntity.components.StaticMapEntity.rotation === node.outRotation){
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
                                 if (nextEntity === initEntity){
                                         break;
                                 }
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
                                node.isCrossing = isCrossing;
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
                // if (belowBelt.components.StaticMapEntity.rotation % 180 === 0) { // 底层 belt 上下
                //         let left = this.root.map.getLayerContentXY(startSep.x - 1, startSep.y, "wires");
                //         let right = this.root.map.getLayerContentXY(startSep.x + 1, startSep.y, "wires");
                //         if ((left && right) || (!left && !right)) {
                //                 this.root.hud.signals.notification.dispatch("同一分离器上的绿线非法", enumNotificationType.error);
                //                 return false;
                //         }
                //         initGreen = left ? left : right;
                //         initGreen.components.StaticMapEntity.rotation = left ? 270 : 90;



                // } else {
                //         let top = this.root.map.getLayerContentXY(startSep.x, startSep.y - 1, "wires");
                //         let bottom = this.root.map.getLayerContentXY(startSep.x, startSep.y + 1, "wires");
                //         if ((top && bottom) || (!top && !bottom)) {
                //                 this.root.hud.signals.notification.dispatch("同一分离器上的绿线非法", enumNotificationType.error);
                //                 return false;
                //         }
                //         initGreen = top ? top : bottom;
                //         initGreen.components.StaticMapEntity.rotation = top ? 0 : 180;
                // }
                // let left = this.root.map.getLayerContentXY(startSep.x - 1, startSep.y, "wires");
                // let right = this.root.map.getLayerContentXY(startSep.x + 1, startSep.y, "wires");
                // let top = this.root.map.getLayerContentXY(startSep.x, startSep.y - 1, "wires");
                // let bottom = this.root.map.getLayerContentXY(startSep.x, startSep.y + 1, "wires");

                let neighbors = [];
                neighbors.push(new Vector(startSep.x, startSep.y - 1));
                neighbors.push(new Vector(startSep.x + 1, startSep.y));
                neighbors.push(new Vector(startSep.x, startSep.y + 1));
                neighbors.push(new Vector(startSep.x - 1, startSep.y));

                for (let nei of neighbors){
                        initGreen = this.root.map.getLayerContentXY(nei.x, nei.y , "wires");
                        if (initGreen){
                                initGreen.components.StaticMapEntity.rotation = neighbors.indexOf(nei) * 90;
                                break;
                        }
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
                                let bCross = false;
                                if (belowEnt) {
                                        bCross = true;
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
                                let node = this.createNodeFromEntity(nextGreen, "green", outRot, bCross);
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
        initRedPath(bForward, redPath){
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

                for (let rNode of redPath){
                        if (!rNode.isCrossing){
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
         * 
         * @param {Strand[]} check_result_crossings 
         * @param {Strand} strand 
         * @returns {Strand}
         */
        get_strand_from_array(check_result_crossings, strand){
                for (let s of check_result_crossings){
                        if (s.node.origin.x === strand.node.origin.x && s.node.origin.y === strand.node.origin.y && s.rot === strand.rot){
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
        do_check(red_path, green_path, direction){
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
                                green_crossing_strands.push(new Strand(this, g, rot, ""));
                        }
                }

                for (let r of red_path) {
                        if (r.isCrossing) {
                                red_boundary_crossings.push(r);
                        }
                }

                
                for (let c of red_boundary_crossings){
                        let rDir;
                        if (this.redBlackSameDirection){
                                rDir = c.outRotation;
                        } else {
                                rDir = (c.outRotation + 180) %360;
                        }
                        let strand;
                        if (direction === "left"){      // 检查从左侧进入圆盘红色边界
                                to_check_set.push(strand = new Strand(this, c, (rDir+ 90) % 360, c.crosType));
                        } else {        // 检查从右侧进入圆盘红色边界
                                to_check_set.push(strand =new Strand(this, c, (rDir + 270) % 360, c.crosType)); 
                        }
                        check_result_crossings.push(strand);
                }

                while (to_check_set.length) {
                        let cross_strand = to_check_set.pop();
                        while (true) {
                               let r = this.get_strand_from_array(check_result_crossings, cross_strand.opposite());
                               if (r && r.crosType !== "" && r.crosType !== cross_strand.crosType){
                                        good_path = false;
                                        break;
                               }
                               r = this.get_strand_from_array(green_crossing_strands, cross_strand)
                               if(r){
                                        r.crosType = cross_strand.crosType;
                                        break;
                               }
                               r = cross_strand.opposite();
                               r.crosType = cross_strand.crosType;
                               if (!this.get_strand_from_array(check_result_crossings, r)){
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
                                                if (c.crosType !== cross_strand.crosType){
                                                        good_path = false;
                                                }
                                                break;
                                        }

                                }
                                if (b) {
                                        break;
                                }

                                if (cross_strand.opposite().node.origin.equals(this.seperators[0]) || cross_strand.opposite().node.origin.equals(this.seperators[1])){
                                        break;
                                }
                        //        if (red_boundary_crossings.indexOf(cross_strand.opposite().node) >= 0){
                        //                break;
                        //        }
                               let oppo = cross_strand.opposite();
                               oppo.crosType = cross_strand.crosType;
                               if (oppo.node.isCrossing){       // 下一个是内部交点
                                        let sideStrand1 = new Strand(this, oppo.node, (oppo.rot + 90) % 360, "");
                                        let sideStrand2 = new Strand(this, oppo.node, (oppo.rot + 270) % 360, "");         
                                        if (oppo.node.crosType === "over" && oppo.crosType ==="under"){
                                                r = this.get_strand_from_array(check_result_crossings, sideStrand1);
                                                if (r && r.crosType === "over"){
                                                        good_path = false;
                                                        break;
                                                } else if (!r) {
                                                        sideStrand1.crosType = "under";
                                                        check_result_crossings.push(sideStrand1);
                                                        to_check_set.push(sideStrand1);
                                                }
                                                r = this.get_strand_from_array(check_result_crossings, sideStrand2);
                                                if (r && r.crosType === "over"){
                                                        good_path = false;
                                                        break;
                                                } else if (!r) {
                                                        sideStrand2.crosType = "under";
                                                        check_result_crossings.push(sideStrand2);
                                                        to_check_set.push(sideStrand2);
                                                }
                                        }

                                        if (oppo.node.crosType === "under" && oppo.crosType ==="over"){
                                                r = this.get_strand_from_array(check_result_crossings, sideStrand1);
                                                if (r && r.crosType === "under"){
                                                        good_path = false;
                                                        break;
                                                } else if (!r) {
                                                        sideStrand1.crosType = "over";
                                                        check_result_crossings.push(sideStrand1);
                                                        to_check_set.push(sideStrand1);
                                                }
                                                r = this.get_strand_from_array(check_result_crossings, sideStrand2);
                                                if (r && r.crosType === "under"){
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
                               console.log(nStrand.node.origin);
                               r = this.get_strand_from_array(check_result_crossings, nStrand);
                               if (!r){
                                        nStrand.crosType = cross_strand.crosType;
                                        check_result_crossings.push(nStrand);
                               }
                               cross_strand = nStrand;                     
                        }
                        if (!good_path){
                                break;
                        }
                }
                if (!good_path){
                        return false;
                }

                for(let gS of green_crossing_strands){
                        for(let gN of this.greenNodes){
                                if (gN.origin.equals(gS.node.origin)){
                                        gN.crosType = gS.crosType;
                                        break;
                                }
                        }
                }

                return good_path;
        }

        reDrawGreenLine(){
                let green_entities = [];
                for (let ent of this.root.entityMgr.entities) {
                        if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 27 || ent.components.StaticMapEntity.code === 28)){ // 绿线
                                green_entities.push(ent);
                        }
                }

                for (let de of green_entities){
                        this.root.logic.tryDeleteBuilding(de);
                }
                // 重绘绿线
                let prevRot = 0;
                for (let curNode of this.greenNodes) {
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

                        if (curNode.crosType === "over"){
                                continue;
                        }

                        let entity = _building.createEntity({
                                root: this.root,
                                origin: curNode.origin,
                                rotation: rot,
                                originalRotation: curNode.outRotation,
                                rotationVariant: rotVar,
                                variant: "default"
                        });

                        let belowEnt = this.root.map.getLayerContentXY(entity.components.StaticMapEntity.origin.x, entity.components.StaticMapEntity.origin.y, "regular");
                        if (belowEnt){
                                this.root.logic.tryDeleteBuilding(belowEnt);
                        }

                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                        this.root.map.placeStaticEntity(entity);
                        this.root.entityMgr.registerEntity(entity);
                        prevRot = curNode.outRotation;
                }
        }

        deleteRedLineBelow(){
                let toDel = [];
                for (let ent of this.root.entityMgr.entities) {
                        if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 52 || ent.components.StaticMapEntity.code === 53)){ // 红线
                                let belowEnt = this.root.map.getLayerContentXY(ent.components.StaticMapEntity.origin.x, ent.components.StaticMapEntity.origin.y, "regular");
                                if (ent){
                                        toDel.push(belowEnt);
                                        toDel.push(ent);
                                }
                        }
                }

                for (let de of toDel){
                        this.root.logic.tryDeleteBuilding(de);
                }
                if (this.redBlackSameDirection) {
                        for (let r of this.redPathForward) {
                                if (r.isCrossing && r.crosType === "under") {
                                        let _building = new MetaBeltBuilding();
                                        let rot;
                                        let e;
                                        if (r.outRotation % 180 ==0){
                                                e = this.root.map.getLayerContentXY(r.origin.x+1, r.origin.y, "regular");
                                        } else {
                                                e = this.root.map.getLayerContentXY(r.origin.x, r.origin.y+1, "regular");
                                        }
                                        rot = e.components.StaticMapEntity.rotation;
                                        let entity = _building.createEntity({
                                                root: this.root,
                                                origin: r.origin,
                                                rotation: rot,
                                                originalRotation: rot,
                                                rotationVariant: 0,
                                                variant: "default"
                                        });
                                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                                        this.root.map.placeStaticEntity(entity);
                                        this.root.entityMgr.registerEntity(entity);
                                }
                        }
                } else {
                        for (let r of this.redPathReverse){
                                if (r.isCrossing && r.crosType === "under") {
                                        let _building = new MetaBeltBuilding();
                                        let rot;
                                        let e;
                                        if (r.outRotation % 180 ==0){
                                                e = this.root.map.getLayerContentXY(r.origin.x+1, r.origin.y, "regular");
                                        } else {
                                                e = this.root.map.getLayerContentXY(r.origin.x, r.origin.y+1, "regular");
                                        }
                                        rot = e.components.StaticMapEntity.rotation;
                                        let entity = _building.createEntity({
                                                root: this.root,
                                                origin: r.origin,
                                                rotation: rot,
                                                originalRotation: rot,
                                                rotationVariant: 0,
                                                variant: "default"
                                        });
                                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                                        this.root.map.placeStaticEntity(entity);
                                        this.root.entityMgr.registerEntity(entity);
                                }
                        }
                }
                

        }

        drawGreenLineBelow(){
                let toDel = [];
                for (let ent of this.root.entityMgr.entities) {
                        if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 27 || ent.components.StaticMapEntity.code === 28)){ // 绿线
                                let belowEnt = this.root.map.getLayerContentXY(ent.components.StaticMapEntity.origin.x, ent.components.StaticMapEntity.origin.y, "regular");
                                if (ent){
                                        toDel.push(ent);
                                }
                        }
                }
                for (let de of toDel){
                        this.root.logic.tryDeleteBuilding(de);
                }
                let reverseDelta = 0;
                if (!this.redPathForward){                        
                        reverseDelta = 180;
                }
                for (let g of this.greenNodes){
                        if (g.crosType === "over"){
                                continue;
                        }
                        let _building = new MetaBeltBuilding();
                        let rot = (g.outRotation + reverseDelta) % 360;
                        let oriRot = (g.outRotation + reverseDelta) % 360;
                        let rotVar = 0;
                        let entity;
                        
                        if (g.isCorner){
                                let inRot, outRot;
                                if (reverseDelta){
                                        inRot = (this.greenNodes[(this.greenNodes.indexOf(g)+1)%this.greenNodes.length].outRotation + reverseDelta) % 360;
                                        outRot = (this.greenNodes[(this.greenNodes.indexOf(g)-1)%this.greenNodes.length].outRotation+reverseDelta) % 360;

                                } else {
                                        inRot = this.greenNodes[(this.greenNodes.indexOf(g)-1)%this.greenNodes.length].outRotation;  
                                        outRot = this.greenNodes[(this.greenNodes.indexOf(g)+1)%this.greenNodes.length].outRotation;
                                }     
                                
                                if ((outRot - inRot + 360) % 360 === 270){
                                        rotVar = 1;
                                } else {
                                        rotVar = 2;
                                }
                                rot = inRot
                        }
                        entity = _building.createEntity({
                                root: this.root,
                                origin: g.origin,
                                rotation: rot,
                                originalRotation: oriRot,
                                rotationVariant: rotVar,
                                variant: "default"
                        });
                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                        this.root.map.placeStaticEntity(entity);
                        this.root.entityMgr.registerEntity(entity);
                }
        }

        drawSepratorBelow(){
                
                
                for (let sep of this.seperators){
                        let sep_node;
                        for (sep_node of this.nodes){
                                if (sep_node.origin.equals(sep)){
                                        break;
                                }
                        }

                        let neighbors = [];
                        neighbors.push(new Vector(sep.x, sep.y - 1));
                        neighbors.push(new Vector(sep.x + 1, sep.y));
                        neighbors.push(new Vector(sep.x, sep.y + 1));
                        neighbors.push(new Vector(sep.x - 1, sep.y));

                        let redOri, greenOri;
                        if (this.redPathForward.length){
                                for (let nei of neighbors){
                                        for (let r of this.redPathForward){
                                                if (r.origin.equals(nei)){
                                                        redOri = nei;
                                                        break;
                                                }
                                        }
                                }
                        } else if (this.redPathReverse.length){
                                for (let nei of neighbors){
                                        for (let r of this.redPathReverse){
                                                if (r.origin.equals(nei)){
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
                        if (outOri === redOri){
                                inRot = this.root.map.getLayerContentXY(sep.x, sep.y, "regular").components.StaticMapEntity.rotation;
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
                                variant: "default"
                        });
                        this.root.logic.freeEntityAreaBeforeBuild(entity);
                        this.root.map.placeStaticEntity(entity);
                        this.root.entityMgr.registerEntity(entity);
                }

                let sep_entities = [];
                for (let ent of this.root.entityMgr.entities) {
                        if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 39)){ // sep
                                sep_entities.push(ent);
                        }
                }

                for (let de of sep_entities){
                        this.root.logic.tryDeleteBuilding(de);
                }

        }

        showRedLine(redPath, bForward){
                // 绘制红线
                let prevRot;
                for (let curNode of redPath) {
                        let _building = new MetaWireBuilding();

                        let rotVar;
                        let rot;
                        if (curNode.isCorner){
                                rotVar = 1;
                                if (bForward){
                                        if (curNode.outRotation === (prevRot + 90) % 360){
                                                rot = prevRot;
                                        } else {
                                                rot = (prevRot + 90) % 360;
                                        }
                                } else {
                                        let i = redPath.indexOf(curNode)
                                        let nextRot = redPath[(i+1) % redPath.length].outRotation;
                                        if (curNode.outRotation === (nextRot + 270) % 360){
                                                rot = (curNode.outRotation + 180) % 360;
                                        } else {
                                                rot = (curNode.outRotation + 270) % 360;
                                        }  
                                }
                                
                        } else {
                                rotVar = 0;
                                if (bForward){
                                        rot = curNode.outRotation
                                } else {
                                        rot = (curNode.outRotation + 180) % 360
                                }
                        }

                        if (curNode.crosType === "over"){
                                continue;
                        }
                        
                        let entity = _building.createEntity({
                                root: this.root,
                                origin: curNode.origin,
                                rotation: rot,
                                originalRotation: curNode.outRotation,
                                rotationVariant: rotVar,
                                variant: "second"
                        });

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
                if (this.greenLineOK ) {
                        this.root.systemMgr.systems.wire.bUpdateSuround = false;
                        this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                        // 已经合规, 第二阶段的 move knot
                        this.deleteRedLineBelow();
                        this.drawGreenLineBelow();
                        this.drawSepratorBelow();
                        this.root.systemMgr.systems.wire.bUpdateSuround = true;
                        //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
                        this.constructorEbd();
                        return;
                }

                // do check
                this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                if (!this.reDirectionGreenLine()) {
                        return;
                }
                
                this.root.hud.signals.notification.dispatch("绿线合规!", enumNotificationType.success);
                this.redPathForward.length = this.redPathReverse.length = 0;
                // 关闭道路自适应
                this.root.systemMgr.systems.wire.bUpdateSuround = false;
                this.initRedPath(true, this.redPathForward);
                this.initRedPath(false, this.redPathReverse);
                this.redPathReverse = this.redPathReverse.reverse();
                // 打开道路自适应
                //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;

                let red_path;
                if (this.redPathForward.length){
                        red_path = this.redPathForward;
                        this.redBlackSameDirection = true;
                } else if (this.redPathReverse.length){
                        red_path = this.redPathReverse;
                        this.redBlackSameDirection = false;
                } else {
                        red_path = null;
                }

                console.log("==================================== check left =================================");
                if (this.do_check(red_path, this.greenNodes, 'left')){        
                        this.root.systemMgr.systems.wire.bUpdateSuround = false;
                        this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                        this.showRedLine(red_path, this.redBlackSameDirection);
                        this.reDrawGreenLine();
                        this.root.systemMgr.systems.wire.bUpdateSuround = true;
                        //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
                        this.greenLineOK = true;
                        return;
                }
                
                console.log("==================================== check right =================================");
                if (this.do_check(red_path, this.greenNodes, 'right')){
                        this.root.systemMgr.systems.wire.bUpdateSuround = false;
                        this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                        this.showRedLine(red_path, this.redBlackSameDirection);
                        this.reDrawGreenLine();
                        this.root.systemMgr.systems.wire.bUpdateSuround = true;
                        //this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
                        this.greenLineOK = true;
                        return;
                }
                
        
                this.root.hud.signals.notification.dispatch("没找到合法红线", enumNotificationType.error);
                return;

        }

}