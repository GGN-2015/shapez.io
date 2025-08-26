import { Vector } from "../core/vector";
import { enumNotificationType } from "./hud/parts/notifications";
import { GameRoot } from "./root";

/**
*
* @param {GameRoot} root
*/
export class Knot {

        /**
         * 
         * @param {GameRoot} root 
         */
        constructor(root) {
                this.unLeagleMessage = "";
                this.root = root;
                this.crossings = [];
                this.corners = [];
                this.seperators = [];
                this.greenLineOK = false;

                let reg_entities = []
                for (let ent of this.root.entityMgr.entities){
                        if (ent.layer === "regular"){
                                reg_entities.push(ent)
                        }
                }
                // 检查 regular 层的 belt 是否构成合法扭结
                let initEntity = reg_entities[0];
                if (!initEntity){
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

                // 这种 travel along knot 的做法多次用到, logic.js 中的 定向整理 也用到, 或许可以整理一个 travel 函数, 传入回调
                do {
                        let nextOrigin = this.root.map.getNextOrigin(curEntity);
                        let nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                        if (!nextEntity){
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
                                // 这是一个交点, 需要去寻找下一个位置
                                let curOrigine = curEntity.components.StaticMapEntity.origin;
                                nextOrigin.x = 2 * nextOrigin.x - curOrigine.x;
                                nextOrigin.y = 2 * nextOrigin.y - curOrigine.y;
                                nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                        } else if (nextEntity.components.StaticMapEntity.code === 2 || nextEntity.components.StaticMapEntity.code === 3){
                                //是 corner
                                this.corners.push(nextEntity);
                        } else if (nextEntity.components.StaticMapEntity.code !== 1){
                                // 非法
                                this.clear("存在非 belt 的建筑块");
                                return;
                        } else {
                                if (!this.root.map.checkNeighborsNull(nextEntity)){
                                        this.clear("过密 lines"); 
                                        return;
                                }
                        }
                        curEntity = nextEntity;
                        mapBeltCount++;
                } while (curEntity !== initEntity)

                if (mapBeltCount !== reg_entities.length){
                        // 有多余 tile
                        this.clear("有多余 tile")
                        return;
                }

                for (let cros of this.crossings) {
                        if (!this.root.map.checkDiagonalEntities(cros.components.StaticMapEntity.origin)) {
                                // 过密位置非法
                                this.clear("过密 crossing");
                                return;
                        }
                }

                for (let cor of this.corners) {
                        if (!this.root.map.checkDiagonalEntities(cor.components.StaticMapEntity.origin)) {
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
        clear(msg){
                this.unLeagleMessage = msg;
                this.crossings = [];
                this.corners = [];
        }

        /**
         * 
         * @returns {String}
         */
        getPDcode(){
                return ""
        }

        
        checkGreenLine(){
                if (this.greenLineOK ) {
                        // 已经合规, 第二阶段的 move knot

                        return;
                }
                this.greenLineOK = true;
                
                // do check

                this.root.hud.signals.notification.dispatch("绿线合规!", enumNotificationType.success);
        }

}