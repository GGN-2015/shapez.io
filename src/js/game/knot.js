import { Vector } from "../core/vector";
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

                // 检查 regular 层的 belt 是否构成合法扭结
                let initEntity = this.root.entityMgr.entities[0];

                if (initEntity.components.StaticMapEntity.code < 1 || initEntity.components.StaticMapEntity.code > 3) {
                        //不是 belt 的 building
                        this.unLeagleMessage = "存在非 belt 的建筑块"
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
                        this.unLeagleMessage = "连续的 crossing 或 corner"
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
                                // 未完整闭锁
                                this.unLeagleMessage = "未完整闭锁"
                                this.crossings = [];
                                this.corners = [];
                                return;
                        }
                        if (passedEntities.indexOf(nextEntity) > 0 && !this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)) {
                                // 通常点二次到达
                                this.unLeagleMessage = "定向整理错误"
                                this.crossings = [];
                                this.corners = [];
                                return;
                        }
                        if (passedEntities.indexOf(nextEntity) !== passedEntities.lastIndexOf(nextEntity) && this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)) {// crossing 已经经过两次以上
                                // 交点的三次到达
                                this.unLeagleMessage = "定向整理错误"
                                this.crossings = [];
                                this.corners = [];
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
                                this.unLeagleMessage = "存在非 belt 的建筑块"
                                this.crossings = [];
                                this.corners = [];
                                return;
                        }
                        curEntity = nextEntity;
                        mapBeltCount++;
                } while (curEntity !== initEntity)

                if (mapBeltCount !== this.root.entityMgr.entities.length){
                        // 有多余 tile
                        this.unLeagleMessage = "有多余 tile"
                        this.crossings = [];
                        this.corners = [];
                        return;
                }

                for (let cros of this.crossings) {
                        if (!this.root.map.checkDiagonalEntities(cros.components.StaticMapEntity.origin)) {
                                // 过密位置非法
                                this.unLeagleMessage = "过密位置"
                                this.crossings = [];
                                this.corners = [];
                                return;
                        }
                }

                for (let cor of this.corners) {
                        if (!this.root.map.checkDiagonalEntities(cor.components.StaticMapEntity.origin)) {
                                // 过密位置非法
                                this.unLeagleMessage = "过密位置"
                                this.crossings = [];
                                this.corners = [];
                                return;
                        }
                }
        }

}