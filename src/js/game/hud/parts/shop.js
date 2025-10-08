import { ClickDetector } from "../../../core/click_detector";
import { InputReceiver } from "../../../core/input_receiver";
import { formatBigNumber, getRomanNumber, makeDiv } from "../../../core/utils";
import { SOUNDS } from "../../../platform/sound";
import { T } from "../../../translations";
import { KeyActionMapper, KEYMAPPINGS } from "../../key_action_mapper";
import { G_STAGES } from "../../stages";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

const copy = require("clipboard-copy");

export class HUDShop extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_Shop", ["ingameDialog"]);

        // DIALOG Inner / Wrapper
        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], T.ingame.shop.title);
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);
        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);

        this.upgradeToElements = {};

        const stars = ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];
        // Upgrades
        // for (const upgradeId in this.root.gameMode.getUpgrades()) {
        for (let i = 0; i < G_STAGES.length; i++) {
            const handle = {};
            handle.requireIndexToElement = [];

            // Wrapper
            handle.elem = makeDiv(this.contentDiv, null, ["upgrade"]);
            handle.elem.setAttribute("data-upgrade-id", i.toString());

            // Title
            const title = makeDiv(handle.elem, null, ["title"], stars[G_STAGES[i].difficulty - 1]);
            makeDiv(handle.elem, null, ["title"], "level " + (i + 1));
            makeDiv(handle.elem, null, ["tier"], T.knot.str36 + ": " + G_STAGES[i].crossings);

            // Title > Tier
            handle.elemTierLabel = makeDiv(title, null, ["tier"]);

            // Icon
            // handle.icon = makeDiv(handle.elem, null, ["icon"]);
            // handle.icon.setAttribute("data-icon", "upgrades/" + upgradeId + ".png");

            // Description
            handle.elemDescription = makeDiv(handle.elem, null, ["description"], "");
            //handle.elemRequirements = makeDiv(handle.elem, null, ["requirements"]);

            // Buy button
            handle.buyButton = document.createElement("button");
            handle.buyButton.classList.add("buy", "styledButton");
            handle.buyButton.innerText = T.ingame.shop.buttonUnlock;
            handle.elem.appendChild(handle.buyButton);
            if (i < 1) {
                // 此处 level 存档还没有被读取
                handle.buyButton.classList.toggle("buyable", true);
            }

            this.trackClicks(handle.buyButton, () => this.tryUnlockNextTier(i));

            // Assign handle
            this.upgradeToElements[i.toString()] = handle;
        }
    }

    rerenderFull() {
        for (const upgradeId in this.upgradeToElements) {
            const handle = this.upgradeToElements[upgradeId];
            const upgradeTiers = this.root.gameMode.getUpgrades()[upgradeId];

            const currentTier = this.root.hubGoals.getUpgradeLevel(upgradeId);
            const currentTierMultiplier = this.root.hubGoals.upgradeImprovements[upgradeId];
            const tierHandle = upgradeTiers[currentTier];

            // Set tier
            // handle.elemTierLabel.innerText = T.ingame.shop.tier.replace(
            //     "<x>",
            //     getRomanNumber(currentTier + 1)
            // );

            // handle.elemTierLabel.setAttribute("data-tier", currentTier);

            // Cleanup detectors
            for (let i = 0; i < handle.requireIndexToElement.length; ++i) {
                const requiredHandle = handle.requireIndexToElement[i];
                requiredHandle.container.remove();
                requiredHandle.pinDetector.cleanup();
                if (requiredHandle.infoDetector) {
                    requiredHandle.infoDetector.cleanup();
                }
            }

            // Cleanup
            handle.requireIndexToElement = [];

            handle.elem.classList.toggle("maxLevel", !tierHandle);

            if (!tierHandle) {
                // Max level
                handle.elemDescription.innerText = T.ingame.shop.maximumLevel.replace(
                    "<currentMult>",
                    formatBigNumber(currentTierMultiplier)
                );
                continue;
            }

            // Set description
            // handle.elemDescription.innerText = T.shopUpgrades[upgradeId].description
            //     .replace("<currentMult>", currentTierMultiplier.toFixed(2))
            //     .replace("<newMult>", (currentTierMultiplier + tierHandle.improvement).toFixed(2));

            // tierHandle.required.forEach(({ shape, amount }) => {
            //     const container = makeDiv(handle.elemRequirements, null, ["requirement"]);

            //     const shapeDef = this.root.shapeDefinitionMgr.getShapeFromShortKey(shape);
            //     const shapeCanvas = shapeDef.generateAsCanvas(120);
            //     shapeCanvas.classList.add();
            //     container.appendChild(shapeCanvas);

            //     const progressContainer = makeDiv(container, null, ["amount"]);
            //     const progressBar = document.createElement("label");
            //     progressBar.classList.add("progressBar");
            //     progressContainer.appendChild(progressBar);

            //     const progressLabel = document.createElement("label");
            //     progressContainer.appendChild(progressLabel);

            //     const pinButton = document.createElement("button");
            //     pinButton.classList.add("pin");
            //     container.appendChild(pinButton);

            //     let infoDetector;
            //     if (!G_WEGAME_VERSION) {
            //         const viewInfoButton = document.createElement("button");
            //         viewInfoButton.classList.add("showInfo");
            //         container.appendChild(viewInfoButton);
            //         infoDetector = new ClickDetector(viewInfoButton, {
            //             consumeEvents: true,
            //             preventDefault: true,
            //         });
            //         infoDetector.click.add(() =>
            //             this.root.hud.signals.viewShapeDetailsRequested.dispatch(shapeDef)
            //         );
            //     }

            //     const currentGoalShape = this.root.hubGoals.currentGoal.definition.getHash();
            //     if (shape === currentGoalShape) {
            //         pinButton.classList.add("isGoal");
            //     } else if (this.root.hud.parts.pinnedShapes.isShapePinned(shape)) {
            //         pinButton.classList.add("alreadyPinned");
            //     }

            //     const pinDetector = new ClickDetector(pinButton, {
            //         consumeEvents: true,
            //         preventDefault: true,
            //     });
            //     pinDetector.click.add(() => {
            //         if (this.root.hud.parts.pinnedShapes.isShapePinned(shape)) {
            //             this.root.hud.signals.shapeUnpinRequested.dispatch(shape);
            //             pinButton.classList.add("unpinned");
            //             pinButton.classList.remove("pinned", "alreadyPinned");
            //         } else {
            //             this.root.hud.signals.shapePinRequested.dispatch(shapeDef);
            //             pinButton.classList.add("pinned");
            //             pinButton.classList.remove("unpinned");
            //         }
            //     });

            //     handle.requireIndexToElement.push({
            //         container,
            //         progressLabel,
            //         progressBar,
            //         definition: shapeDef,
            //         required: amount,
            //         pinDetector,
            //         infoDetector,
            //     });
            // });
        }
    }

    renderCountsAndStatus() {
        // for (const upgradeId in this.upgradeToElements) {
        //     const handle = this.upgradeToElements[upgradeId];
        //     // for (let i = 0; i < handle.requireIndexToElement.length; ++i) {
        //     //     const { progressLabel, progressBar, definition, required } = handle.requireIndexToElement[i];
        //     //     const haveAmount = this.root.hubGoals.getShapesStored(definition);
        //     //     const progress = Math.min(haveAmount / required, 1.0);
        //     //     progressLabel.innerText = formatBigNumber(haveAmount) + " / " + formatBigNumber(required);
        //     //     progressBar.style.width = progress * 100.0 + "%";
        //     //     progressBar.classList.toggle("complete", progress >= 1.0);
        //     // }
        //     // handle.buyButton.classList.toggle("buyable", this.root.hubGoals.canUnlockUpgrade(upgradeId));
        //     //handle.buyButton.classList.toggle("buyable", true);
        // }
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReciever = new InputReceiver("shop");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReciever);

        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuOpenShop).add(this.close, this);

        this.close();

        // this.rerenderFull();
        this.root.signals.upgradePurchased.add(this.rerenderFull, this);
    }

    cleanup() {
        // Cleanup detectors
        for (const upgradeId in this.upgradeToElements) {
            const handle = this.upgradeToElements[upgradeId];
            for (let i = 0; i < handle.requireIndexToElement.length; ++i) {
                const requiredHandle = handle.requireIndexToElement[i];
                requiredHandle.container.remove();
                requiredHandle.pinDetector.cleanup();
                if (requiredHandle.infoDetector) {
                    requiredHandle.infoDetector.cleanup();
                }
            }
            handle.requireIndexToElement = [];
        }
    }

    // Zanellati http://arxiv.org/abs/1508.03226
    // KnotSolver .kns 的存储格式
    knsString() {
        let max_x = -Infinity;
        let min_x = Infinity;
        let max_y = -Infinity;
        let min_y = Infinity;
        for (let entity of this.root.entityMgr.entities) {
            if (entity.layer !== "regular") {
                continue;
            }
            if (entity.components.StaticMapEntity.origin.x < min_x) {
                min_x = entity.components.StaticMapEntity.origin.x;
            }
            if (entity.components.StaticMapEntity.origin.x > max_x) {
                max_x = entity.components.StaticMapEntity.origin.x;
            }
            if (entity.components.StaticMapEntity.origin.y < min_y) {
                min_y = entity.components.StaticMapEntity.origin.y;
            }
            if (entity.components.StaticMapEntity.origin.y > max_y) {
                max_y = entity.components.StaticMapEntity.origin.y;
            }
        }
        let width = max_x - min_x + 1;
        let height = max_y - min_y + 1;
        let arr = [];
        for (let i = 0; i < width; i++) {
            let line = [];
            for (let j = 0; j < height; j++) {
                line.push(" ");
            }
            arr.push(line);
        }

        for (let entity of this.root.entityMgr.entities) {
            if (entity.layer !== "regular") {
                continue;
            }
            if (entity.components.StaticMapEntity.code === 1) {
                if (this.root.map.isCrossingEntity(entity.components.StaticMapEntity.origin)) {
                    if (entity.components.StaticMapEntity.rotation % 180 === 0) {
                        arr[entity.components.StaticMapEntity.origin.x - min_x][
                            entity.components.StaticMapEntity.origin.y - min_y
                        ] = "-";
                    } else {
                        arr[entity.components.StaticMapEntity.origin.x - min_x][
                            entity.components.StaticMapEntity.origin.y - min_y
                        ] = "|";
                    }
                } else {
                    arr[entity.components.StaticMapEntity.origin.x - min_x][
                        entity.components.StaticMapEntity.origin.y - min_y
                    ] = "*";
                }
            }
        }

        let str = "" + width + "," + height + "," + "Source=C:\\Users\\A\\Desktop\\无标题.jpg,Size=3\n";
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                str += arr[i][j];
            }
            str += "\n";
        }
        return str;
    }

    show() {
        // let str = this.knsString();
        // copy(str);
        // console.log(str);
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReciever);
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReciever);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
        if (this.visible) {
            this.renderCountsAndStatus();
        }
    }

    tryUnlockNextTier(upgradeId) {
        // if (this.root.hubGoals.tryUnlockUpgrade(upgradeId)) {
        //     this.root.app.sound.playUiSound(SOUNDS.unlockUpgrade);
        // }
        const signals = this.root.hud.parts.dialogs.showWarning(
            T.knot.str34 + (upgradeId + 1) + " ?",
            T.knot.str35,
            ["cancel", "ok:good"]
        );
        signals.ok.add(() => {
            this.root.logic.loadState(upgradeId);
            this.close();
        });
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
