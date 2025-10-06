// @ts-ignore
import KnotWorker from "../webworkers/knot.worker";
import { Vector } from "../core/vector";
import { KnotSimplifier } from "./knotSimplifier";
import { GameRoot } from "./root";
import { Node } from "./knotUtils";
import { enumNotificationType } from "./hud/parts/notifications";
import { DialogWithForm } from "../core/modal_dialog_elements";
import { fillInLinkIntoTranslation } from "../core/utils";
import { THIRDPARTY_URLS } from "../core/config";
import { FormElementInput } from "../core/modal_dialog_forms";
import { T } from "../translations";

const copy = require("clipboard-copy");

export class Knot {
    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;
        this.unLeagleMessage;

        /**
         * @type {Node[][]} nodes
         */
        this.nodes; // 按扭结序的各坐标点, 构造后可直接遍历, 相当于沿扭结 travel

        /**
         * @type {import("./entity").Entity[]}
         */
        this.crossings;

        /**
         * @type {import("./entity").Entity[]}
         */
        this.corners;

        if (!this.root.knotSimplifier) {
            this.root.knotSimplifier = new KnotSimplifier(this.root);
        }

        this.rebuild();
    }

    /**
     *
     * @param {Map} reg_entities
     * @param {*} node
     * @param {*} component
     */
    pushEntity(reg_entities, node, component) {
        component.push(node);
        // for (let i = 0; i < reg_entities.length; i++) {
        //     let ent = reg_entities[i];
        //     if (
        //         ent.components.StaticMapEntity.origin.x === node.origin.x &&
        //         ent.components.StaticMapEntity.origin.y === node.origin.y
        //     ) {
        //         reg_entities.splice(i, 1);
        //     }
        // }
        // 换成 map 应该能快一点
        if (reg_entities.has(node.origin)) {
            reg_entities.delete(node.origin);
        }
    }

    rebuild() {
        this.unLeagleMessage = "";
        this.nodes = [];
        this.crossings = [];
        this.corners = [];
        let reg_entities = new Map();

        for (let ent of this.root.entityMgr.entities) {
            if (ent.layer === "regular") {
                reg_entities.set(ent.components.StaticMapEntity.origin, ent);
            }
        }

        let passedEntities = [];

        while (reg_entities.size) {
            let initEntity = reg_entities.values().next().value;
            if (!initEntity) {
                this.clear(T.knot.str1);
                return;
            }

            if (
                initEntity.components.StaticMapEntity.code < 1 ||
                initEntity.components.StaticMapEntity.code > 3
            ) {
                //不是 belt 的 building
                this.clear(T.knot.str2);
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
                this.clear(T.knot.str3);
                return;
            }

            let componet = [];
            let curEntity = initEntity;

            passedEntities.push(curEntity);
            let node = this.createNodeFromEntity(
                curEntity,
                "black",
                curEntity.components.StaticMapEntity.rotation,
                false
            );
            this.pushEntity(reg_entities, node, componet);

            for (;;) {
                let nextOrigin = this.root.map.getNextOrigin(curEntity);
                let nextEntity = this.root.map.getLayerContentXY(nextOrigin.x, nextOrigin.y, "regular");
                if (nextEntity === initEntity) {
                    break;
                }
                if (!nextEntity) {
                    // 未完整闭合
                    this.clear(T.knot.str4);
                    return;
                }
                if (
                    passedEntities.indexOf(nextEntity) > 0 &&
                    !this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)
                ) {
                    // 通常点二次到达
                    this.clear(T.knot.str5);
                    return;
                }
                if (
                    passedEntities.indexOf(nextEntity) !== passedEntities.lastIndexOf(nextEntity) &&
                    this.root.map.isCrossingEntity(nextEntity.components.StaticMapEntity.origin)
                ) {
                    // crossing 已经经过两次以上
                    // 交点的三次到达
                    this.clear(T.knot.str5);
                    return;
                }
                passedEntities.push(nextEntity);
                if (this.root.map.isCrossingEntity(nextOrigin)) {
                    if (this.crossings.indexOf(nextEntity) < 0) {
                        // 对于交点会遍历到两次, 但只添加一次
                        this.crossings.push(nextEntity);
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
                    } else if (
                        nextEntity.components.StaticMapEntity.rotation ===
                        (node.outRotation + 180) % 360
                    ) {
                        this.clear(T.knot.str5);
                        return;
                    } else {
                        node.crosType = "under";
                    }
                    this.pushEntity(reg_entities, node, componet);
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
                    this.pushEntity(reg_entities, node, componet);
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
                    this.pushEntity(reg_entities, node, componet);
                } else if (nextEntity.components.StaticMapEntity.code !== 1) {
                    // 非法
                    this.clear(T.knot.str2);
                    return;
                } else {
                    if (!this.root.map.checkNeighborsNull(nextEntity, "regular")) {
                        this.clear(T.knot.str6);
                        return;
                    }
                    let node = this.createNodeFromEntity(
                        nextEntity,
                        "black",
                        nextEntity.components.StaticMapEntity.rotation,
                        false
                    );
                    this.pushEntity(reg_entities, node, componet);
                }
                curEntity = nextEntity;
            }
            this.nodes.push(componet);
        }
        // console.log(this.nodes);

        for (let cros of this.crossings) {
            if (!this.root.map.checkDiagonalEntities(cros.components.StaticMapEntity.origin, "regular")) {
                // 过密位置非法
                this.clear(T.knot.str8);
                return;
            }
        }

        for (let cor of this.corners) {
            if (!this.root.map.checkDiagonalEntities(cor.components.StaticMapEntity.origin, "regular")) {
                // 过密位置非法
                this.clear(T.knot.str9);
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
     * @param {Vector} origin
     * @returns {Node[]}
     */
    getNodeComponent(origin) {
        for (let comp of this.nodes) {
            for (let n of comp) {
                if (origin.equals(n.origin)) return comp;
            }
        }
        return null;
    }

    /**
     *
     * @param {Node} cros
     * @returns {Node}
     */
    getNextCrossingNode(cros) {
        let c = cros;
        let comp = this.getNodeComponent(cros.origin);
        for (;;) {
            c = comp[(comp.indexOf(c) + 1) % comp.length];
            if (c.isCrossing) {
                return c;
            }
        }
    }

    /**
     *
     * @param {Node} cros
     * @returns {Node}
     */
    getPrevCrossingNode(cros) {
        let comp = this.getNodeComponent(cros.origin);
        for (let c of comp) {
            if (c.isCrossing && this.getNextCrossingNode(c) === cros) {
                return c;
            }
        }
        return null;
    }

    getPDcode() {
        this.root.app.gPaused = true;
        //this.root.hud.parts.settingsMenu.show();
        const worker = new KnotWorker();
        let msg_label = document.getElementById("keybinding message");
        msg_label.setAttribute(
            "style",
            'font-family: "GameFont", sans-serif;font-size: calc(26px * var(--ui-scale));'
        );
        worker.postMessage({
            nodes: this.nodes,
        });
        worker.onmessage = e => {
            if (e.data.type === "update") {
                msg_label.innerHTML = e.data.str;
            } else if (e.data.type === "res") {
                copy(e.data.str);
                this.root.hud.signals.notification.dispatch(T.knot.str10, enumNotificationType.success);
                this.root.app.gPaused = false;
                worker.terminate();
                const markerNameInput = new FormElementInput({
                    id: "markerName",
                    label: null,
                    placeholder: "",
                    defaultValue: e.data.str.split("#")[0],
                    validator: val => val.length > 0,
                });
                const markerNameInput1 = new FormElementInput({
                    id: "markerName",
                    label: null,
                    placeholder: "",
                    defaultValue: e.data.str.split("#")[1],
                    validator: val => val.length > 0,
                });
                const dialog = new DialogWithForm({
                    app: this.root.app,
                    title: "PD code",
                    desc: fillInLinkIntoTranslation(T.knot.str11, THIRDPARTY_URLS.shapeViewer),
                    formElements: [markerNameInput, markerNameInput1],
                    buttons: ["ok:good"],
                });
                this.root.hud.parts.dialogs.internalShowDialog(dialog);
            }
        };
    }

    /**
     *
     * @param { import("./entity").Entity } entity
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
     * 注意 origin 不可以是交点!
     * @param {Vector} origin
     * @returns {number}
     */
    getBeltNodeIndex(origin, comp) {
        // let comp = this.getNodeComponent(origin);
        for (let n of comp) {
            if (n.origin.equals(origin)) {
                return comp.indexOf(n);
            }
        }
        return Infinity;
    }
}
