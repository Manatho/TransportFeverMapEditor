<template>
    <div>
        <canvas ref="threejs"></canvas>
        <div>
            <TerrainObjectEditor></TerrainObjectEditor>
            <div class="height-output">
                Height:
                <span class="height-number">{{toolCenteredVertex.y.toFixed(0)}}m</span>
                <br>
                <label class="container">
                    <span>Show contour:</span>
                    <input type="checkbox" v-model="contour" @change="onContour">
                    <span class="checkmark"></span>
                </label>
            </div>
        </div>
    </div>
</template>

<script>
//UI
import TerrainObjectEditor from "./terrain-object-editor.vue";

//Libs and logic
let THREE = require("../../../libs/threemin.js");
let InputController = require("./scripts/input.js").Controller;
let Camera = require("./scripts/camera.js").Camera;
let ToolEffect = require("./scripts/tool-effect-visualiser.js").ToolEffect;
import { Controller, ControllerEvents } from "../../logic/controller.js";
import { Terrain, TerrainUniforms } from "../../logic/terrain.js";
let scene;

function initAddons() {
    InputController.init(Controller.requestRender);
    Camera.init(InputController);
    ToolEffect.init(scene, InputController, Camera);
}

function setupToolApply() {
    let mouse3D;
    let raycaster = new THREE.Raycaster();
    let townIntersect = null;

    let onDocumentMouseDown = event => {
        mouse3D = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        if (Controller.tool.name == "town") {
            if (townIntersect.length == 0 && event.button == 0) {
                Controller.deselectTerrainObject();
                raycaster.setFromCamera(mouse3D, Camera.ThreeCamera);
                Controller.applyTool(raycaster, event.button);
            } else if (townIntersect.length > 0) {
                if (event.button == 2) {
                    Controller.deselectTerrainObject();
                    Controller.removeTerrainObject(
                        townIntersect[0].object.owner
                    );
                } else if (event.button == 0) {
                    Controller.terrainObjectSelected(
                        townIntersect[0].object.owner
                    );
                }
            }
        } else {
            Controller.applyTool(raycaster, event.button);
            let reapply = 5;

            let test = setInterval(() => {
                if (InputController.isMouseDown) {
                    if (event.button != 1) {
                        raycaster.setFromCamera(mouse3D, Camera.ThreeCamera);
                        Controller.applyTool(raycaster, event.button);
                        Controller.terrain.terrainObjects.updatePosition();
                    }
                } else {
                    clearInterval(test);
                }
            }, reapply);
        }
    };

    let raycaster2 = new THREE.Raycaster();
    let hoveredMap = [];
    let onDocumentMouseMove = event => {
        mouse3D = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        if (Controller.tool.name == "town") {
            raycaster2.setFromCamera(mouse3D, Camera.ThreeCamera);
            townIntersect = raycaster2.intersectObjects(
                Controller.terrain.terrainObjects.meshes
            );

            if (townIntersect.length == 0) {
                if (hoveredMap.length > 0) {
                    hoveredMap.forEach(object => {
                        object.owner.unhovered();
                    });
                    hoveredMap = [];
                }
            } else {
                let intersected = townIntersect[0].object;
                intersected.owner.hovered();
                hoveredMap.push(intersected);
            }
        }
    };

    InputController.add("mousedown", onDocumentMouseDown, { render: true });
    InputController.add("mousemove", onDocumentMouseMove, { render: true });
}

function setupThree(canvas) {
    //Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbab8b4);

    initAddons();
    setupToolApply();

    let renderer = new THREE.WebGLRenderer({
        antialias: false,
        canvas: canvas
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    //document.body.insertBefore(renderer.domElement, document.body.firstChild);
    renderer.domElement.className = "Three";
    renderer.domElement.addEventListener("mousedown", e => {
        document.activeElement.blur();
    });

    function renderloop() {
        if (Controller.render) {
            Camera.update();
            renderer.render(scene, Camera.ThreeCamera);
        }
        requestAnimationFrame(renderloop);
    }
    renderloop();

    window.addEventListener("resize", onWindowResize, false);

    function onWindowResize() {
        Camera.ThreeCamera.aspect = window.innerWidth / window.innerHeight;
        Camera.ThreeCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    Controller.subscribe(ControllerEvents.Event_Terrain_Changed, setTerrain);
    Controller.subscribe(
        ControllerEvents.Event_Terrain_object_Added,
        addTerrainObject
    );
    Controller.subscribe(
        ControllerEvents.Event_Terrain_object_Removed,
        removeTerrainObject
    );
}

let terrain;
function setTerrain(newterrain) {
    if (terrain) {
        terrain.removeFromScene(scene);
        terrain.terrainObjects.removeAllFromScene(scene);
    }
    terrain = newterrain;
    if (newterrain != null) {
        newterrain.addToScene(scene);
        newterrain.terrainObjects.addAllToScene(scene);
    }
}

function addTerrainObject(object) {
    object.addToScene(scene);
}

function removeTerrainObject(object) {
    object.removeFromScene(scene);
}

export default {
    components: {
        TerrainObjectEditor
    },
    mounted() {
        setupThree(this.$refs.threejs);
        window.scene = scene;
    },
    data() {
        return {
            toolCenteredVertex: ToolEffect.centeredVertex,
            contour: TerrainUniforms.drawContour.value
        };
    },
    methods: {
        onContour(event) {
            TerrainUniforms.drawContour.value = this.contour;
            Controller.requestRender();
        }
    }
};
</script>

<style lang="scss">
@import "../../../style/variables.scss";
.Three {
    display: block;
    position: relative;
}

.height-output {
    position: absolute;
    bottom: 0px;
    right: 0px;

    padding: 5px;
    margin: 10px;

    background-color: $element-background;
    border: $element-border;
    border-radius: 5px;
    box-shadow: 0 1px 2px 0px rgba(0, 0, 0, 0.384);
    font-family: $font;
    font-size: 0.8em;
    //font-weight: bold;
}

.height-number {
    background-color: $element-backgroundlight;
    border-radius: 5px;
    padding: 1px;
    font-size: 1.1em;
    font-weight: bold;
}

.container {
    display: block;
    position: relative;
    margin-top: 5px;
    cursor: pointer;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

.container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}

.checkmark {
    display: inline-block;
    height: 12px;
    width: 12px;
    background-color: $element-backgroundlight;
    border-radius: 3px;
    margin-left: 3px;
}

.container:hover input ~ .checkmark {
    background-color: #ccc;
}

.checkmark:after {
    content: "";
    position: absolute;
    display: none;
}

.container input:checked ~ .checkmark:after {
    display: block;
    content: "x";
}

.container .checkmark:after {
    display: inline-block;
    content: "";
    font-weight: bold;
    font-size: 1em;
    margin-left: 2px;
    margin-top: -2px;
}
</style>


