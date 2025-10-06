import { Node } from "../game/knotUtils";
import { Strand } from "../game/knotUtils";
import { Vector } from "../core/vector";

let greenNodes;

/** @type {Node[][]} */
let knotNodes;
/** @type {Node[]} */
let keyNodes;
/** @type {{strand: Strand, next: Strand, opposite: Strand}[]} */
let keyRelations;
let redBlackSameDirection;
let seperators;

let check_result_array;
let red_path_array;

self.addEventListener("message", e => {
    // @ts-ignore
    if (e.data.type === "start") {
        // @ts-ignore
        greenNodes = e.data.greenNodes;
        // @ts-ignore
        //redBlackSameDirection = e.data.redBlackSameDirection;
        // @ts-ignore
        seperators = e.data.seperators;
        // @ts-ignore
        red_path_array = e.data.red_path_array;
        check_result_array = [];
        knotNodes = [];
        // @ts-ignore
        knotNodes = e.data.nodes;
        // for (let node of e.data.nodes) {
        //     // 为了让 node 有 .origin.equals 方法, 每个重新复制一遍
        //     let n = new Node(node.origin);
        //     n.color = node.color;
        //     n.crosType = node.crosType;
        //     n.isCorner = node.isCorner;
        //     n.isCrossing = node.isCrossing;
        //     n.outRotation = node.outRotation;
        //     knotNodes.push(n);
        // }
        console.log("knotSimplifier.worker start!");

        trimKnot();

        console.log("============================== check left =================================");
        checkGreenLineDirection(red_path_array, "left");
        console.log("============================= check right =================================");
        checkGreenLineDirection(red_path_array, "right");
        self.postMessage({ type: "update", str: "" });
        self.postMessage({ type: "res", check_result_array: check_result_array });
    }
});

/**
 *
 * @param {Node} node
 * @param {Node[]} arr
 * @returns {boolean}
 */
function isNodeInArray(node, arr) {
    for (let n of arr) {
        if (n.origin.x === node.origin.x && n.origin.y === node.origin.y) {
            return true;
        }
    }
    return false;
}

function trimKnot() {
    console.log("trimKnot start");
    keyNodes = [];
    keyRelations = [];

    for (let comp of knotNodes) {
        for (let node of comp) {
            // 只保留: 1. 交点; 2, 绿色交点下方; 3, seprator
            if (
                node.crosType !== "" ||
                isNodeInArray(node, greenNodes) ||
                (node.origin.x === seperators[0].x && node.origin.y === seperators[0].y) ||
                (node.origin.x === seperators[1].x && node.origin.y === seperators[1].y)
            ) {
                keyNodes.push(node);
            }
        }
    }

    for (let key of keyNodes) {
        let initStrand = new Strand(knotNodes, key, key.outRotation, key.crosType);
        let outStrand = initStrand;
        for (;;) {
            outStrand = outStrand.next();
            if (isNodeInArray(outStrand.node, keyNodes)) {
                break;
            }
        }
        keyRelations.push({ strand: initStrand, next: outStrand, opposite: outStrand.opposite().next() });
        let reverseStrand = initStrand.opposite().next();
        outStrand = reverseStrand;
        for (;;) {
            outStrand = outStrand.next();
            if (isNodeInArray(outStrand.node, keyNodes)) {
                break;
            }
        }
        keyRelations.push({ strand: reverseStrand, next: outStrand, opposite: outStrand.opposite().next() });
    }
    // for (let r of keyRelations) {
    //     console.log(
    //         "(" +
    //             r.strand.node.origin.x +
    //             "," +
    //             r.strand.node.origin.y +
    //             "," +
    //             r.strand.rot +
    //             ")" +
    //             " | " +
    //             "(" +
    //             r.next.node.origin.x +
    //             "," +
    //             r.next.node.origin.y +
    //             "," +
    //             r.next.rot +
    //             ")" +
    //             " | " +
    //             "(" +
    //             r.opposite.node.origin.x +
    //             "," +
    //             r.opposite.node.origin.y +
    //             "," +
    //             r.opposite.rot +
    //             ")"
    //     );
    // }
}
/**
 *
 * @param {Strand[]} check_result_crossings
 * @param {Strand} strand
 * @returns {Strand}
 */
function get_strand_from_array(check_result_crossings, strand) {
    for (let s of check_result_crossings) {
        if (
            s.node.origin.x === strand.node.origin.x &&
            s.node.origin.y === strand.node.origin.y &&
            s.rot === strand.rot
        ) {
            return s;
        }
    }
    return null;
}

/**
 *
 * @param {Strand} strand
 * @returns {Strand}
 */
function keyStrandOpposite(strand) {
    for (let o of keyRelations) {
        if (
            o.strand.node.origin.x === strand.node.origin.x &&
            o.strand.node.origin.y === strand.node.origin.y &&
            o.strand.rot === strand.rot
        ) {
            return o.opposite;
        }
    }
    return null;
}

/**
 *
 * @param {Strand} strand
 * @returns {Strand}
 */
function keyStrandNext(strand) {
    for (let o of keyRelations) {
        if (
            o.strand.node.origin.x === strand.node.origin.x &&
            o.strand.node.origin.y === strand.node.origin.y &&
            o.strand.rot === strand.rot
        ) {
            return o.next;
        }
    }
    return null;
}

/**
 *
 * @param {Node[]} arr
 */
function debugLogNodeArr(arr) {
    for (let n of arr) {
        console.log("(" + n.origin.x + "," + n.origin.y + ")" + n.crosType);
    }
}

/**
 *
 * @param {Strand[]} check_result_crossings
 */
function debugPrintCheck_result_crossings(check_result_crossings) {
    for (let strand of check_result_crossings) {
        console.log(
            "(" + strand.node.origin.x + "," + strand.node.origin.y + ")" + strand.rot + "|" + strand.crosType
        );
    }
}

/**
 *
 * @param {Node[]} red_path
 * @param {Node[]} green_path
 * @param {String} direction
 * @returns {boolean}
 */
function do_check(red_path, green_path, direction) {
    let red_boundary_crossings = [];
    let to_check_set = [];
    let check_result_crossings = [];
    let green_crossing_strands = [];

    let good_path = true;

    // console.log("====red_path========");
    // debugLogNodeArr(red_path);
    // console.log("========greenNodes===");
    // debugLogNodeArr(greenNodes);

    for (let g of greenNodes) {
        if (g.isCrossing) {
            let rot;
            if (direction == "left") {
                rot = (g.outRotation + 90) % 360;
            } else {
                rot = (g.outRotation + 270) % 360;
            }
            green_crossing_strands.push(new Strand(knotNodes, g, rot, g.crosType));

            if (g.crosType !== "") {
                let strand;
                check_result_crossings.push(
                    (strand = new Strand(knotNodes, g, (rot + 180) % 360, g.crosType))
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
        if (redBlackSameDirection) {
            rDir = c.outRotation;
        } else {
            rDir = (c.outRotation + 180) % 360;
        }
        let strand;
        if (direction === "left") {
            // 检查从左侧进入圆盘红色边界
            to_check_set.push((strand = new Strand(knotNodes, c, (rDir + 90) % 360, c.crosType)));
        } else {
            // 检查从右侧进入圆盘红色边界
            to_check_set.push((strand = new Strand(knotNodes, c, (rDir + 270) % 360, c.crosType)));
        }
        check_result_crossings.push(strand);
    }

    // console.log("====red_boundary_crossings========");
    // debugLogNodeArr(red_boundary_crossings);

    let nnnn = 0;
    while (to_check_set.length) {
        // console.log("====green_crossing_strands===");
        //debugPrintCheck_result_crossings(green_crossing_strands);
        let cross_strand = to_check_set.pop();
        // console.log(
        //     "L269: (" + cross_strand.node.origin.x + "," + cross_strand.node.origin.y + ")" + cross_strand.rot
        // );
        //msg_label.innerHTML = "already: " + nnnn + ", left: " + to_check_set.length;
        // console.log("already: " + nnnn + ", left: " + to_check_set.length);
        self.postMessage({ type: "update", str: "already: " + nnnn + ", left: " + to_check_set.length });
        nnnn++;
        let already_checked_strand = [];
        for (;;) {
            // 避免多分支时候死循环
            if (already_checked_strand.indexOf(cross_strand) >= 0) {
                break;
            }

            // console.log("====check_result_crossings===");
            //debugPrintCheck_result_crossings(check_result_crossings);
            let r = get_strand_from_array(green_crossing_strands, cross_strand);
            if (r) {
                // console.log(2);
                r.crosType = cross_strand.crosType;
                break;
            }
            r = get_strand_from_array(check_result_crossings, keyStrandOpposite(cross_strand));
            if (r && r.crosType !== "" && r.crosType !== cross_strand.crosType) {
                // console.log(1);
                good_path = false;
                break;
            }

            r = keyStrandOpposite(cross_strand);
            r.crosType = cross_strand.crosType;
            if (!get_strand_from_array(check_result_crossings, r)) {
                check_result_crossings.push(r);
            }
            r = get_strand_from_array(to_check_set, keyStrandOpposite(cross_strand));
            if (r) {
                to_check_set.splice(to_check_set.indexOf(r), 1);
            }

            let b = false;
            for (let c of red_boundary_crossings) {
                if (
                    c.origin.x === keyStrandOpposite(cross_strand).node.origin.x &&
                    c.origin.y === keyStrandOpposite(cross_strand).node.origin.y
                ) {
                    b = true;
                    if (c.crosType !== cross_strand.crosType) {
                        // console.log(3);
                        good_path = false;
                    }
                    break;
                }
            }
            if (b) {
                break;
            }

            let kkk = keyStrandOpposite(cross_strand);
            if (
                (kkk.node.origin.x === seperators[0].x && kkk.node.origin.y === seperators[0].y) ||
                (kkk.node.origin.x === seperators[1].x && kkk.node.origin.y === seperators[1].y)
            ) {
                break;
            }

            let oppo = keyStrandOpposite(cross_strand);
            oppo.crosType = cross_strand.crosType;
            if (oppo.node.isCrossing) {
                // 下一个是内部交点
                let sideStrand1 = new Strand(knotNodes, oppo.node, (oppo.rot + 90) % 360, "");
                let sideStrand2 = new Strand(knotNodes, oppo.node, (oppo.rot + 270) % 360, "");
                if (oppo.node.crosType === "over" && oppo.crosType === "under") {
                    r = get_strand_from_array(check_result_crossings, sideStrand1);
                    if (r && r.crosType === "over") {
                        good_path = false;
                        break;
                    } else if (!r) {
                        sideStrand1.crosType = "under";
                        check_result_crossings.push(sideStrand1);
                        to_check_set.push(sideStrand1);
                    }
                    r = get_strand_from_array(check_result_crossings, sideStrand2);
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
                    r = get_strand_from_array(check_result_crossings, sideStrand1);
                    if (r && r.crosType === "under") {
                        good_path = false;
                        break;
                    } else if (!r) {
                        sideStrand1.crosType = "over";
                        check_result_crossings.push(sideStrand1);
                        to_check_set.push(sideStrand1);
                    }
                    r = get_strand_from_array(check_result_crossings, sideStrand2);
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
            let nStrand = keyStrandNext(cross_strand);
            nStrand.crosType = cross_strand.crosType;
            // console.log(nStrand.node.origin);
            r = get_strand_from_array(check_result_crossings, nStrand);
            if (!r) {
                nStrand.crosType = cross_strand.crosType;
                check_result_crossings.push(nStrand);
            }

            already_checked_strand.push(cross_strand);
            cross_strand = nStrand;
        }
        if (!good_path) {
            break;
        }
    }
    if (!good_path) {
        return false;
    }

    // 在 greenNodes 中返回 crosType
    for (let gS of green_crossing_strands) {
        for (let gN of greenNodes) {
            if (gN.origin.x === gS.node.origin.x && gN.origin.y === gS.node.origin.y) {
                gN.crosType = gS.crosType;
                break;
            }
        }
    }

    return good_path;
}

function clone(t) {
    let o = new Vector(t.origin.x, t.origin.y);
    let r = new Node(o);
    r.color = t.color;
    r.isCrossing = t.isCrossing;
    r.outRotation = t.outRotation;
    r.isCorner = t.isCorner;
    r.crosType = t.crosType;
    return r;
}

/**
 *
 * @param {Node[]} nodesArr
 * @returns {Node[]}
 */
function cloneNodesArray(nodesArr) {
    let res = [];
    for (let n of nodesArr) {
        res.push(clone(n));
    }
    return res;
}

/**
 *
 * @param {Node[]} nodesArr
 * @returns {boolean}
 */
function isNodesArrayNotExist(nodesArr, r_path) {
    for (let r of check_result_array) {
        if (JSON.stringify(r.gNodes) === JSON.stringify(nodesArr) && r.rPath === r_path) {
            return false;
        }
    }
    return true;
}

function checkGreenLineDirection(red_path_array, dir) {
    for (let ent of red_path_array) {
        let r_path = ent.path;
        let bSameDir = ent.dir;

        let greenUnknownCrossing = [];

        redBlackSameDirection = bSameDir;

        for (let gN of greenNodes) {
            gN.crosType = "";
        }

        if (r_path.length && do_check(r_path, greenNodes, dir)) {
            for (let gN of greenNodes) {
                if (gN.isCrossing && gN.crosType === "") {
                    greenUnknownCrossing.push(gN);
                }
            }

            if (greenUnknownCrossing.length) {
                // 存在未定交点类型
                if (greenUnknownCrossing.length > 10) {
                    /*
                    this.root.hud.signals.notification.dispatch(
                        "未定交点过多, 将随机布置",
                        enumNotificationType.warning
                    );
                    */
                    let newNodesArr = cloneNodesArray(greenNodes);
                    if (isNodesArrayNotExist(newNodesArr, r_path)) {
                        check_result_array.push({
                            gNodes: cloneNodesArray(greenNodes),
                            rPath: r_path,
                            rPathDir: bSameDir,
                        });
                    }
                } else {
                    console.log("未定交点数: " + greenUnknownCrossing.length);
                    for (let rand = 0; rand < 1 << greenUnknownCrossing.length; rand++) {
                        for (let i = 0; i < greenUnknownCrossing.length; i++) {
                            greenUnknownCrossing[i].crosType = (rand >> i) % 2 ? "under" : "over";
                        }
                        if (r_path.length && do_check(r_path, greenNodes, dir)) {
                            let newNodesArr = cloneNodesArray(greenNodes);
                            if (isNodesArrayNotExist(newNodesArr, r_path)) {
                                check_result_array.push({
                                    gNodes: cloneNodesArray(greenNodes),
                                    rPath: r_path,
                                    rPathDir: bSameDir,
                                });
                            }
                        }
                    }
                }
            } else {
                let newNodesArr = cloneNodesArray(greenNodes);
                if (isNodesArrayNotExist(newNodesArr, r_path)) {
                    check_result_array.push({
                        gNodes: cloneNodesArray(greenNodes),
                        rPath: r_path,
                        rPathDir: bSameDir,
                    });
                }
            }
        }
    }
}
