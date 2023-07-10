import {
    AmbientLight,
    AxesHelper,
    DirectionalLight,
    GridHelper,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    Raycaster,
    Vector2,
    Loader,
    MeshLambertMaterial,
    MeshBasicMaterial
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from 'web-ifc-three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree
} from "three-mesh-bvh";

//Creates the Three.js scene
const scene = new Scene();
const canvas = document.getElementById('three-canvas');
//Object to store the size of the viewport
const size = {
    width: window.innerWidth,
    height: window.innerHeight,
};

//Creates the camera (point of view of the user)
const camera = new PerspectiveCamera(75, size.width / size.height);
camera.position.z = 15;
camera.position.y = 13;
camera.position.x = 8;

//Creates the lights of the scene
const lightColor = 0xffffff;

const ambientLight = new AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(lightColor, 2);
directionalLight.position.set(0, 10, 0);
scene.add(directionalLight);

//Sets up the renderer, fetching the canvas of the HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new WebGLRenderer({ canvas: threeCanvas, alpha: true });
renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.style.top = '0';
document.body.appendChild(labelRenderer.domElement);

//Creates grids and axes in the scene
const grid = new GridHelper(50, 30);
scene.add(grid);

const axes = new AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 1;
scene.add(axes);

//Creates the orbit controls (to navigate the scene)
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
controls.target.set(-2, 0, 0);

//Animation loop
const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(animate);
};

animate();

//Adjust the viewport to the size of the browser
window.addEventListener("resize", () => {
    (size.width = window.innerWidth), (size.height = window.innerHeight);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
    labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
});

//IFC loading
const input = document.getElementById("file-input");
const ifcLoader = new IFCLoader();
const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

// Sets up optimized picking
ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);

const ifcModels = [];


input.addEventListener(
    'change',
    async () => {
        const file = input.files[0];
        const url = URL.createObjectURL(file);
        const model = await ifcLoader.loadAsync(url);
        scene.add(model);
        ifcModels.push(model);
    }
);



// picking

window.addEventListener('dblclick', (event) => {
    mouse.x = event.clientX / canvas.clientWidth * 2 - 1;
    mouse.y = - (event.clientY / canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObjects(ifcModels);

    if (!intersection.length) return;

    const collisionLocation = intersection[0].point;

    const message = window.prompt('Describe the issue');

    const container = document.createElement('div');
    container.className = 'label-container';

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.className = 'delete-button hidden';
    container.appendChild(deleteButton);

    const label = document.createElement('p');
    label.textContent = message;
    label.classList.add('label');
    container.appendChild(label);

    const labelObject = new CSS2DObject(container);
    labelObject.position.copy(collisionLocation);
    scene.add(labelObject);

    deleteButton.onclick = () => {
        labelObject.removeFromParent();
        labelObject.element = null;
        container.remove();
    }

    container.onmouseenter = () => deleteButton.classList.remove('hidden');
    container.onmouseleave = () => deleteButton.classList.add('hidden');
});


function cast(event) {

    // Computes the position of the mouse on the screen
    const bounds = threeCanvas.getBoundingClientRect();

    const x1 = event.clientX - bounds.left;
    const x2 = bounds.right - bounds.left;
    mouse.x = (x1 / x2) * 2 - 1;

    const y1 = event.clientY - bounds.top;
    const y2 = bounds.bottom - bounds.top;
    mouse.y = -(y1 / y2) * 2 + 1;

    // Places it on the camera pointing to the mouse
    raycaster.setFromCamera(mouse, camera);

    // Casts a ray
    return raycaster.intersectObjects(ifcModels);
}

const highlightMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.6,
    color: 0xff88ff,
    depthTest: false
})

let lastModel;

function pick(event) {
    const found = cast(event)[0];
    if (found) {
        const index = found.faceIndex;
        lastModel = found.object;
        const geometry = found.object.geometry;
        const id = ifcLoader.ifcManager.getExpressId(geometry, index);
        console.log(id);

        ifcLoader.ifcManager.createSubset({
            modelID: found.object.modelID,
            material: highlightMaterial,
            ids: [id],
            scene,
            removePrevious: true
        });
    } else if (lastModel) {
        ifcLoader.ifcManager.removeSubset(lastModel.modelID, highlightMaterial);
        lastModel = undefined;
    }
}

threeCanvas.onclick = (event) => pick(event);

