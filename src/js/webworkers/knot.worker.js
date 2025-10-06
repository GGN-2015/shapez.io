import { Vector } from "../core/vector";
import { Node } from "../game/knotUtils";

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
    let c = cros;
    let comp = getNodeComponent(cros);
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
function getPrevCrossingNode(cros) {
    let comp = getNodeComponent(cros);
    for (let c of comp) {
        if (c.isCrossing && getNextCrossingNode(c) === cros) {
            return c;
        }
    }
    return null;
}

function getPDcodeWorker(nodes) {
    let res = "";
    let crossings = [];
    if (!nodes.length) {
        return res;
    }

    // 用每个 cros node 表示它的 out strand
    for (let comp of nodes) {
        for (let n of comp) {
            if (n.isCrossing) {
                crossings.push(n);
            }
        }
    }

    let idx = 0;
    let debugStr = "";
    // for (let c of crossings) {
    //     console.log(c.origin.x + "," + c.origin.y + "|" + c.crosType);
    // }
    for (let c of crossings) {
        //msg_label.innerHTML = crossings.indexOf(c) + "/" + crossings.length;
        self.postMessage({ type: "update", str: crossings.indexOf(c) + "/" + crossings.length });
        // console.log(crossings.indexOf(c) + "/" + crossings.length);
        let pd = [-1, -1, -1, -1];

        if (c.crosType === "over") {
            let under_c;
            for (under_c of crossings) {
                console.log(under_c.origin.x + "," + under_c.origin.y + "|" + under_c.crosType);
                if (
                    under_c.origin.x === c.origin.x &&
                    under_c.origin.y === c.origin.y &&
                    under_c.crosType === "under"
                ) {
                    break;
                }
            }
            if (c.outRotation === (under_c.outRotation + 90) % 360) {
                pd[0] = crossings.indexOf(getPrevCrossingNode(under_c));
                pd[2] = crossings.indexOf(under_c);
                pd[1] = crossings.indexOf(c);
                pd[3] = crossings.indexOf(getPrevCrossingNode(c));
            } else {
                pd[0] = crossings.indexOf(getPrevCrossingNode(under_c));
                pd[2] = crossings.indexOf(under_c);
                pd[3] = crossings.indexOf(c);
                pd[1] = crossings.indexOf(getPrevCrossingNode(c));
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
