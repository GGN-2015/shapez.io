import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { globalConfig } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { Loader } from "../../../core/loader";
import { lerp } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { enumHubGoalRewards } from "../../tutorial_goals";
import { BaseHUDPart } from "../base_hud_part";
import { Knot } from "../../knot";
import { enumNotificationType } from "./notifications";

const copy = require("clipboard-copy");
const wiresBackgroundDpi = 4;

export class HUDWiresOverlay extends BaseHUDPart {
    createElements(parent) {}

    initialize() {
        // Probably not the best location, but the one which makes most sense
        this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.switchLayers).add(this.switchLayers, this);
        this.root.keyMapper.getBinding(KEYMAPPINGS.placement.copyWireValue).add(this.copyWireValue, this);

        this.generateTilePattern();

        this.currentAlpha = 0.0;
    }

    /**
     * 
    */
    initKnot(root) {
        this.root.knot = new Knot(this.root);
        if (!this.root.knot.corners.length) {// 可以没有 crossing, 但至少要有 corner 
            this.root.hud.signals.notification.dispatch(this.root.knot.unLeagleMessage, enumNotificationType.error);
            return false

        }

        let sepOK = true; 
        if (this.root.knot) {
            this.root.knot.redPathForward.length = this.root.knot.redPathReverse.length = 0;
            for (let ori of this.root.knot.seperators) {
                if (this.root.knot.checkSeperatorIleagle(ori)) {
                    //return false;
                   sepOK = false;
            }
        }

            if (!sepOK) {
                let sep_entities = [];
                for (let ent of this.root.entityMgr.entities) {
                    if (ent.layer === "wires" && (ent.components.StaticMapEntity.code === 39)) { // sep
                        sep_entities.push(ent);
                    }
                }

                for (let de of sep_entities) {
                    this.root.logic.tryDeleteBuilding(de);
                }
            }
        }
        

        this.root.hud.signals.notification.dispatch("构建扭结成功", enumNotificationType.success);
        // 打开 wire 路径自适应, 方便绘制绿线
        this.root.systemMgr.systems.wire.bUpdateSuround = true;
        return true;

    }

    /**
     * Switches between layers
     */
    switchLayers() {
        if (!this.root.gameMode.getSupportsWires()) {
            return;
        }
        if (this.root.currentLayer === "regular") {
            if (
                this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers) ||
                (G_IS_DEV && globalConfig.debug.allBuildingsUnlocked)
            ) {
                this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                if (this.initKnot(this.root)){
                    this.root.currentLayer = "wires";
                    this.root.systemMgr.systems.belt.bUpdateSurrounding = false;
                }
                this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
                
            }
        } else {
            this.root.currentLayer = "regular";
            this.root.systemMgr.systems.belt.bUpdateSurrounding = true;
        }
        this.root.signals.editModeChanged.dispatch(this.root.currentLayer);
    }

    /**
     * Generates the background pattern for the wires overlay
     */
    generateTilePattern() {
        //const overlayTile = Loader.getSprite("sprites/wires/overlay_tile.png");
        const dims = globalConfig.tileSize * wiresBackgroundDpi;
        const [canvas, context] = makeOffscreenBuffer(dims, dims, {
            smooth: false,
            reusable: false,
            label: "wires-tile-pattern",
        });
        context.clearRect(0, 0, dims, dims);
        //  overlayTile.draw(context, 0, 0, dims, dims); 去掉绿色背景
        this.tilePatternCanvas = canvas;
    }

    update() {
        const desiredAlpha = this.root.currentLayer === "wires" ? 1.0 : 0.0;

        // On low performance, skip the fade
        if (this.root.entityMgr.entities.length > 5000 || this.root.dynamicTickrate.averageFps < 50) {
            this.currentAlpha = desiredAlpha;
        } else {
            this.currentAlpha = lerp(this.currentAlpha, desiredAlpha, 0.12);
        }
    }

    /**
     * Copies the wires value below the cursor
     */
    copyWireValue() {
        if (this.root.currentLayer !== "wires") {
            return;
        }

        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            return;
        }

        const tile = this.root.camera.screenToWorld(mousePos).toTileSpace();
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "wires");
        if (!contents) {
            return;
        }

        let value = null;
        if (contents.components.Wire) {
            const network = contents.components.Wire.linkedNetwork;
            if (network && network.hasValue()) {
                value = network.currentValue;
            }
        }

        if (contents.components.ConstantSignal) {
            value = contents.components.ConstantSignal.signal;
        }

        if (value) {
            copy(value.getAsCopyableKey());
            this.root.soundProxy.playUi(SOUNDS.copy);
        } else {
            copy("");
            this.root.soundProxy.playUiError();
        }
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        if (this.currentAlpha < 0.02) {
            return;
        }

        const hasTileGrid = !this.root.app.settings.getAllSettings().disableTileGrid;
        if (hasTileGrid && !this.cachedPatternBackground) {
            this.cachedPatternBackground = parameters.context.createPattern(this.tilePatternCanvas, "repeat");
        }

        const bounds = parameters.visibleRect;

        parameters.context.globalAlpha = this.currentAlpha;

        const scaleFactor = 1 / wiresBackgroundDpi;
        parameters.context.globalCompositeOperation = "overlay";
        parameters.context.fillStyle = "rgba(50, 200, 150, 0.2)";
        parameters.context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        parameters.context.globalCompositeOperation = "source-over";

        parameters.context.scale(scaleFactor, scaleFactor);
        parameters.context.fillStyle = hasTileGrid
            ? this.cachedPatternBackground
            : "rgba(78, 137, 125, 0.2)";
        parameters.context.fillRect(
            bounds.x / scaleFactor,
            bounds.y / scaleFactor,
            bounds.w / scaleFactor,
            bounds.h / scaleFactor
        );
        parameters.context.scale(1 / scaleFactor, 1 / scaleFactor);

        parameters.context.globalAlpha = 1;
    }
}
