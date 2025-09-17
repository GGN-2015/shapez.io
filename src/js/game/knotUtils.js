import { Vector } from "../core/vector";

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
     * @param {import("./knot").Knot} knot
     * @param {Node} node
     * @param {number} rot
     * @param {String} type
     */
    constructor(knot, node, rot, type) {
        this.knot = knot;
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
        for (let i = 0; i < this.knot.nodes.length; i++) {
            let node = this.knot.nodes[i];
            if (node.origin.equals(this.node.origin)) {
                if (node.isCorner) {
                    if (node.outRotation === this.rot) {
                        return new Strand(
                            this.knot,
                            this.knot.nodes[(i + 1) % this.knot.nodes.length],
                            (this.rot + 180) % 360,
                            ""
                        );
                    } else {
                        return new Strand(
                            this.knot,
                            this.knot.nodes[(i + this.knot.nodes.length - 1) % this.knot.nodes.length],
                            (this.rot + 180) % 360,
                            ""
                        );
                    }
                } else {
                    if ((node.outRotation - this.rot) % 180 === 0) {
                        let delta = node.outRotation === this.rot ? 1 : this.knot.nodes.length - 1;
                        return new Strand(
                            this.knot,
                            this.knot.nodes[(i + delta) % this.knot.nodes.length],
                            (this.rot + 180) % 360,
                            ""
                        );
                    }
                }
            }
        }
        return null;
    }

    next() {
        for (let i = 0; i < this.knot.nodes.length; i++) {
            let node = this.knot.nodes[i];
            if (this.node.isCorner) {
                if (node.origin.equals(this.node.origin)) {
                    if (node.outRotation === this.rot) {
                        return new Strand(
                            this.knot,
                            this.knot.nodes[(i + 1) % this.knot.nodes.length],
                            this.knot.nodes[(i + 1) % this.knot.nodes.length].outRotation,
                            ""
                        );
                    } else {
                        return new Strand(
                            this.knot,
                            this.knot.nodes[(i + this.knot.nodes.length - 1) % this.knot.nodes.length],
                            this.rot,
                            ""
                        );
                    }
                }
            } else if (node.origin.equals(this.node.origin) && (node.outRotation - this.rot) % 180 === 0) {
                let delta = node.outRotation === this.rot ? 1 : this.knot.nodes.length - 1;
                if (delta === 1) {
                    return new Strand(
                        this.knot,
                        this.knot.nodes[(i + delta) % this.knot.nodes.length],
                        this.knot.nodes[(i + delta) % this.knot.nodes.length].outRotation,
                        ""
                    );
                } else {
                    return new Strand(
                        this.knot,
                        this.knot.nodes[(i + delta) % this.knot.nodes.length],
                        (this.knot.nodes[(i + delta - 1) % this.knot.nodes.length].outRotation + 180) % 360,
                        ""
                    );
                }
            }
        }
        return null;
    }

    clone() {
        return new Strand(this.knot, this.node.clone(), this.rot, this.crosType);
    }
}
