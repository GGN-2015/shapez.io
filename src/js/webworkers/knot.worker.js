import { Vector } from "../core/vector";
import { Node, Strand } from "../game/knotUtils";

/**
 * {Node}
 */
let nodes;

self.addEventListener("message", event => {
    // @ts-ignore
    //console.log(event.data.nodes);
    // @ts-ignore
    nodes = event.data.nodes;
    getPDcodeWorker(nodes);
});

/**
 *
 * @param {Node} node
 * @returns {Node[]}
 */
function getNodeComponent(node) {
    for (let comp of nodes) {
        for (let n of comp) {
            if (node.origin.x === n.origin.x && node.origin.y === n.origin.y && node.crosType === n.crosType)
                return comp;
        }
    }
    return null;
}

/**
 *
 * @param {Node} cros
 * @returns {Node}
 */
function getNextCrossingNode(cros) {
    let keyString = cros.origin.x + "|" + cros.origin.y + "|" + cros.outRotation;
    return keyRelations.get(keyString).next.node;
}

/**
 *
 * @param {Node} cros
 * @returns {Node}
 */
function getPrevCrossingNode(cros) {
    let keyString = cros.origin.x + "|" + cros.origin.y + "|" + ((cros.outRotation + 180) % 360);
    return keyRelations.get(keyString).next.node;
}

let keyNodes;
let keyRelations;

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

function trimKnot(nodes) {
    console.log("trimKnot start");
    keyNodes = [];
    keyRelations = new Map();

    for (let comp of nodes) {
        for (let node of comp) {
            if (node.crosType !== "") {
                keyNodes.push(node);
            }
        }
    }

    for (let key of keyNodes) {
        // debugger;
        self.postMessage({
            type: "update",
            str: "trim knot: " + keyNodes.indexOf(key) + " / " + keyNodes.length,
        });
        let initStrand = new Strand(nodes, key, key.outRotation, key.crosType);
        let outStrand = initStrand;
        for (;;) {
            outStrand = outStrand.next();
            if (isNodeInArray(outStrand.node, keyNodes)) {
                break;
            }
        }
        // keyRelations.push({ strand: initStrand, next: outStrand, opposite: outStrand.opposite().next() });
        keyRelations.set(initStrand.keyString(), { next: outStrand, opposite: outStrand.opposite().next() });
        let reverseStrand = initStrand.opposite().next();
        outStrand = reverseStrand;
        for (;;) {
            outStrand = outStrand.next();
            if (isNodeInArray(outStrand.node, keyNodes)) {
                break;
            }
        }
        // keyRelations.push({ strand: reverseStrand, next: outStrand, opposite: outStrand.opposite().next() });
        keyRelations.set(reverseStrand.keyString(), {
            next: outStrand,
            opposite: outStrand.opposite().next(),
        });
    }
    // debugger;
}

function getPDcodeWorker(nodes) {
    trimKnot(nodes);
    let res = "";
    // let crossings = [];
    if (!nodes.length) {
        return res;
    }

    let idx = 0;
    let debugStr = "";
    // for (let c of crossings) {
    //     console.log(c.origin.x + "," + c.origin.y + "|" + c.crosType);
    // }

    for (let c of keyNodes) {
        //msg_label.innerHTML = crossings.indexOf(c) + "/" + crossings.length;
        self.postMessage({ type: "update", str: keyNodes.indexOf(c) + "/" + keyNodes.length });
        // console.log(crossings.indexOf(c) + "/" + crossings.length);
        let pd = [-1, -1, -1, -1];

        if (c.crosType === "over") {
            let oppo = keyRelations.get(c.origin.x + "|" + c.origin.y + "|" + ((c.outRotation + 90) % 360))
                .opposite;
            let under_c = keyRelations.get(oppo.keyString()).opposite.node;
            if (c.outRotation === (under_c.outRotation + 90) % 360) {
                pd[0] = keyNodes.indexOf(getPrevCrossingNode(under_c));
                pd[2] = keyNodes.indexOf(under_c);
                pd[1] = keyNodes.indexOf(c);
                pd[3] = keyNodes.indexOf(getPrevCrossingNode(c));
            } else {
                pd[0] = keyNodes.indexOf(getPrevCrossingNode(under_c));
                pd[2] = keyNodes.indexOf(under_c);
                pd[3] = keyNodes.indexOf(c);
                pd[1] = keyNodes.indexOf(getPrevCrossingNode(c));
            }
            if (res === "") {
                res += "[";
            } else {
                res += ", ";
            }
            debugStr += idx + ": (" + c.origin.x + "," + c.origin.y + ") | ";
            //console.log(idx + ": (" + c.origin.x + "," + c.origin.y + ")");
            idx++;
            res += "(" + pd[0] + ", " + pd[1] + ", " + pd[2] + ", " + pd[3] + ")";
            //console.log("(" + pd[0] + ", " + pd[1] + ", " + pd[2] + ", " + pd[3] + ")");
            debugStr += "(" + pd[0] + ", " + pd[1] + ", " + pd[2] + ", " + pd[3] + ")  ";
        }
    }
    // console.log(debugStr);
    if (res !== "") {
        res += "]";
    }

    self.postMessage({ type: "update", str: "" });
    self.postMessage({ type: "res", str: res + "#" + debugStr });
}

// 测试
function GaussCode(crossings) {
    let GaussStr = "GaussCode=";
    let initC = crossings[0];

    let iGauss = 0;
    let curC = initC;
    let already = new Map();

    console.log("crossing length: " + crossings.length);
    // already.set(initC.origin, iGauss);
    for (;;) {
        // console.log(iGauss);
        let indice;
        if (curC.crosType === "over") {
            let under_c;
            for (under_c of crossings) {
                // console.log(under_c.origin.x + "," + under_c.origin.y + "|" + under_c.crosType);
                if (
                    under_c.origin.x === curC.origin.x &&
                    under_c.origin.y === curC.origin.y &&
                    under_c.crosType === "under"
                ) {
                    break;
                }
            }
            if (curC.outRotation === (under_c.outRotation + 90) % 360) {
                console.log(
                    "ind 1 " +
                        curC.origin.x +
                        "," +
                        curC.origin.y +
                        "|" +
                        curC.crosType +
                        "|" +
                        curC.outRotation
                );
                console.log(
                    "ind 1 " +
                        under_c.origin.x +
                        "," +
                        under_c.origin.y +
                        "|" +
                        under_c.crosType +
                        "|" +
                        under_c.outRotation
                );
                indice = 1;
            } else {
                indice = -1;
            }
        } else {
            let over_c;
            for (over_c of crossings) {
                // console.log(over_c.origin.x + "," + over_c.origin.y + "|" + over_c.crosType);
                if (
                    over_c.origin.x === curC.origin.x &&
                    over_c.origin.y === curC.origin.y &&
                    over_c.crosType === "over"
                ) {
                    break;
                }
            }
            if (over_c.outRotation === (curC.outRotation + 90) % 360) {
                indice = 1;
            } else {
                indice = -1;
            }
        }
        let idx;
        if (already.has(curC.origin)) {
            idx = already.get(curC.origin).idx;
        } else {
            idx = ++iGauss;
            already.set(curC.origin, { idx: idx, indice: indice });
        }
        if (curC.crosType === "under") {
            GaussStr += "-";
        }
        GaussStr += idx + ",";
        let nextC = getNextCrossingNode(curC);
        // console.log(nextC.origin.x + "," + nextC.origin.y);
        if (nextC === initC) break;
        curC = nextC;
    }
    GaussStr += "Indices=";
    console.log(already.size);
    for (let i = 0; i < already.size; i++) {
        for (let value of already.values()) {
            if (value.idx === i + 1) {
                GaussStr += value.indice + ",";
                break;
            }
        }
    }
    return GaussStr;
}
