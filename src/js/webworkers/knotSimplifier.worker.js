import { Node } from "../game/knotUtils";
import { Strand } from "../game/knotUtils";
import { Vector } from "../core/vector";

let greenNodes;
let knotNodes;
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
        // knotNodes = e.data.nodes;
        for (let node of e.data.nodes) {
            // 为了让 node 有 .origin.equals 方法, 每个重新复制一遍
            let n = new Node(node.origin);
            n.color = node.color;
            n.crosType = node.crosType;
            n.isCorner = node.isCorner;
            n.isCrossing = node.isCrossing;
            n.outRotation = node.outRotation;
            knotNodes.push(n);
        }
        console.log("knotSimplifier.worker start!");
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

    let nnnn = 0;
    while (to_check_set.length) {
        let cross_strand = to_check_set.pop();
        //msg_label.innerHTML = "already: " + nnnn + ", left: " + to_check_set.length;
        console.log("already: " + nnnn + ", left: " + to_check_set.length);
        self.postMessage({ type: "update", str: "already: " + nnnn + ", left: " + to_check_set.length });
        nnnn++;
        for (;;) {
            let r = get_strand_from_array(check_result_crossings, cross_strand.opposite());
            if (r && r.crosType !== "" && r.crosType !== cross_strand.crosType) {
                good_path = false;
                break;
            }
            r = get_strand_from_array(green_crossing_strands, cross_strand);
            if (r) {
                r.crosType = cross_strand.crosType;
                break;
            }
            r = cross_strand.opposite();
            r.crosType = cross_strand.crosType;
            if (!get_strand_from_array(check_result_crossings, r)) {
                check_result_crossings.push(r);
            }
            r = get_strand_from_array(to_check_set, cross_strand.opposite());
            if (r) {
                to_check_set.splice(to_check_set.indexOf(r), 1);
            }

            let b = false;
            for (let c of red_boundary_crossings) {
                if (
                    c.origin.x === cross_strand.opposite().node.origin.x &&
                    c.origin.y === cross_strand.opposite().node.origin.y
                ) {
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
                (cross_strand.opposite().node.origin.x === seperators[0].x &&
                    cross_strand.opposite().node.origin.y === seperators[0].y) ||
                (cross_strand.opposite().node.origin.x === seperators[1].x &&
                    cross_strand.opposite().node.origin.y === seperators[1].y)
            ) {
                break;
            }

            let oppo = cross_strand.opposite();
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
            let nStrand = cross_strand.next();
            nStrand.crosType = cross_strand.crosType;
            //console.log(nStrand.node.origin);
            r = get_strand_from_array(check_result_crossings, nStrand);
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
