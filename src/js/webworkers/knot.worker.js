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
    self.postMessage("子线程返回消息");
});

/**
 *
 * @param {Node} cros
 * @returns {Node}
 */
function getNextCrossingNode(cros) {
    let c = cros;
    for (;;) {
        c = nodes[(nodes.indexOf(c) + 1) % nodes.length];
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
    for (let c of nodes) {
        if (c.isCrossing && getNextCrossingNode(c) === cros) {
            return c;
        }
    }
    return null;
}

function getPDcodeWorker(nodes) {
    //let msg_label = document.getElementById("keybinding message");
    let res = "";
    let crossings = [];
    if (!nodes.length) {
        return res;
    }

    // 用每个 cros node 表示它的 out strand
    for (let n of nodes) {
        if (n.isCrossing) {
            crossings.push(n);
        }
    }
    for (let c of crossings) {
        //msg_label.innerHTML = crossings.indexOf(c) + "/" + crossings.length;
        self.postMessage({ type: "update", str: crossings.indexOf(c) + "/" + crossings.length });
        //console.log(crossings.indexOf(c) + "/" + crossings.length);
        let pd = [-1, -1, -1, -1];

        if (c.crosType === "over") {
            //console.log(nodes.indexOf(c.x));
            let under_c;
            for (under_c of nodes) {
                if (under_c.origin.x === c.origin.x && under_c.origin.y === c.origin.y && under_c !== c) {
                    break;
                }
            }
            //console.log(nodes.indexOf(under_c.x));
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
            res += "(" + pd[0] + ", " + pd[1] + ", " + pd[2] + ", " + pd[3] + ")";
        }
    }
    if (res !== "") {
        res += "]";
    }
    self.postMessage({ type: "update", str: "" });
    self.postMessage({ type: "res", str: res });
}
