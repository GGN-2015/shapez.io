import { Vector } from "../core/vector";

export class Node {
    /**
     *
     * @param {Vector} origin
     */
    constructor(origin) {
        /** @type {Vector} origin */
        this.origin = origin;
        this.color = "black";
        this.isCrossing = false;
        this.outRotation = 0;
        this.isCorner = false;

        this.crosType = ""; // over 表示 black 线在上, under 表示 black 线在下
    }

    clone() {
        let r = new Node(this.origin.copy());
        r.color = this.color;
        r.isCrossing = this.isCrossing;
        r.outRotation = this.outRotation;
        r.isCorner = this.isCorner;
        r.crosType = this.crosType;
        return r;
    }
}

export class Strand {
    // strand 是指一个 node 加上一个 rotation(direction)
    /**
     * @param {Node[][]} knotNodes
     * @param {Node} node
     * @param {number} rot
     * @param {String} type
     */
    constructor(knotNodes, node, rot, type) {
        this.knotNodes = knotNodes;
        /** @type {Node} node */
        this.node = node;
        this.rot = rot;
        this.crosType = type;
    }
    /**
     *                     |                |
     *                     |                |
     *        -------------a-1------------3-b-2---------
     *                     |                |
     *                     |                |
     *
     *      (a,1).opposite: (b,3)
     *      (a,1).next: (b,2)
     */

    opposite() {
        for (let comp of this.knotNodes) {
            for (let i = 0; i < comp.length; i++) {
                let node = comp[i];
                if (node.origin.x === this.node.origin.x && node.origin.y === this.node.origin.y) {
                    if (node.isCorner) {
                        if (node.outRotation === this.rot) {
                            return new Strand(
                                this.knotNodes,
                                comp[(i + 1) % comp.length],
                                (this.rot + 180) % 360,
                                ""
                            );
                        } else {
                            return new Strand(
                                this.knotNodes,
                                comp[(i + comp.length - 1) % comp.length],
                                (this.rot + 180) % 360,
                                ""
                            );
                        }
                    } else {
                        if ((node.outRotation - this.rot) % 180 === 0) {
                            let delta = node.outRotation === this.rot ? 1 : comp.length - 1;
                            return new Strand(
                                this.knotNodes,
                                comp[(i + delta) % comp.length],
                                (this.rot + 180) % 360,
                                ""
                            );
                        }
                    }
                }
            }
        }
        return null;
    }

    next() {
        for (let comp of this.knotNodes) {
            for (let i = 0; i < comp.length; i++) {
                let node = comp[i];
                if (this.node.isCorner) {
                    if (node.origin.x === this.node.origin.x && node.origin.y === this.node.origin.y) {
                        if (node.outRotation === this.rot) {
                            return new Strand(
                                this.knotNodes,
                                comp[(i + 1) % comp.length],
                                comp[(i + 1) % comp.length].outRotation,
                                ""
                            );
                        } else {
                            return new Strand(
                                this.knotNodes,
                                comp[(i + comp.length - 1) % comp.length],
                                this.rot,
                                ""
                            );
                        }
                    }
                } else if (
                    node.origin.x === this.node.origin.x &&
                    node.origin.y === this.node.origin.y &&
                    (node.outRotation - this.rot) % 180 === 0
                ) {
                    let delta = node.outRotation === this.rot ? 1 : comp.length - 1;
                    if (delta === 1) {
                        return new Strand(
                            this.knotNodes,
                            comp[(i + delta) % comp.length],
                            comp[(i + delta) % comp.length].outRotation,
                            ""
                        );
                    } else {
                        return new Strand(
                            this.knotNodes,
                            comp[(i + delta) % comp.length],
                            (comp[(i + delta - 1) % comp.length].outRotation + 180) % 360,
                            ""
                        );
                    }
                }
            }
        }
        return null;
    }

    clone() {
        return new Strand(this.knotNodes, this.node.clone(), this.rot, this.crosType);
    }

    keyString() {
        return (
            this.node.origin.x.toString() + "|" + this.node.origin.y.toString() + "|" + this.rot.toString()
        );
    }
}
