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
  MeshBasicMaterial,
  MOUSE,
  Vector3,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  MathUtils,
  Clock,
  Camera
} from 'three'
import CameraControls from 'camera-controls'
import { IFCLoader } from 'web-ifc-three'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Stats from 'stats.js/src/Stats'
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
} from 'three-mesh-bvh'
import {
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCDOOR,
  IFCWINDOW,
  IFCFURNISHINGELEMENT,
  IFCMEMBER,
  IFCPLATE
} from 'web-ifc'
import { models } from './const'

// 1 Scene
const scene = new Scene()
let ifcLoader = new IFCLoader()

const canvas = document.getElementById('three-canvas')
let model
const ifcModels = []

// Creates grids and axes in the scene
const grid = new GridHelper(50, 30)
scene.add(grid)

const axes = new AxesHelper()
axes.material.depthTest = false
axes.renderOrder = 1
scene.add(axes)

// Object to store the size of the viewport
const size = {
  width: window.innerWidth,
  height: window.innerHeight
}

// 3 the camera (point of view of the user)
const camera = new PerspectiveCamera(75, size.width / size.height)
camera.position.z = 15
camera.position.y = 13
camera.position.x = 8

// 4 Sets up the renderer, fetching the canvas of the HTML
const renderer = new WebGLRenderer({ canvas, alpha: true })
renderer.setSize(size.width, size.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.pointerEvents = 'none'
labelRenderer.domElement.style.top = '0'
document.body.appendChild(labelRenderer.domElement)

// 5 the lights of the scene
const lightColor = 0xffffff

const ambientLight = new AmbientLight(lightColor, 0.5)
scene.add(ambientLight)

const directionalLight = new DirectionalLight(lightColor, 2)
directionalLight.position.set(0, 10, 0)
scene.add(directionalLight)

// 6 responsivity
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight)
})

// 7 Creates the orbit controls (to navigate the scene)
const subsetOfTHREE = {
  MOUSE,
  Vector2,
  Vector3,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  Raycaster,
  MathUtils: {
    DEG2RAD: MathUtils.DEG2RAD,
    clamp: MathUtils.clamp
  }
}

CameraControls.install({ THREE: subsetOfTHREE })
const clock = new Clock()
const cameraControls = new CameraControls(camera, canvas)
cameraControls.dollyToCursor = true
cameraControls.setLookAt(18, 20, 18, 0, 10, 0)

// Sets up optimized picking
ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast)

// 8 Tree view
const toggler = document.getElementsByClassName('caret')
for (let i = 0; i < toggler.length; i++) {
  toggler[i].onclick = () => {
    toggler[i].parentElement.querySelector('.nested').classList.toggle('active')
    toggler[i].classList.toggle('caret-down')
  }
}

function createTreeMenu (ifcProject) {
  const root = document.getElementById('tree-root')
  removeAllChildren(root)
  const ifcProjectNode = createNestedChild(root, ifcProject)
  ifcProject.children.forEach(child => {
    constructTreeMenuNode(ifcProjectNode, child)
  })
}

function nodeToString (node) {
  return `${node.type} - ${node.expressID}`
}

function constructTreeMenuNode (parent, node) {
  const children = node.children
  if (children.length === 0) {
    createSimpleChild(parent, node)
    return
  }
  const nodeElement = createNestedChild(parent, node)
  children.forEach(child => {
    constructTreeMenuNode(nodeElement, child)
  })
}

function createNestedChild (parent, node) {
  const content = nodeToString(node)
  const root = document.createElement('li')
  createTitle(root, content)
  const childrenContainer = document.createElement('ul')
  childrenContainer.classList.add('nested')
  root.appendChild(childrenContainer)
  parent.appendChild(root)
  return childrenContainer
}

function createTitle (parent, content) {
  const title = document.createElement('span')
  title.classList.add('caret')
  title.onclick = () => {
    title.parentElement.querySelector('.nested').classList.toggle('active')
    title.classList.toggle('caret-down')
  }
  title.textContent = content
  parent.appendChild(title)
}

function createSimpleChild (parent, node) {
  const content = nodeToString(node)
  const childNode = document.createElement('li')
  childNode.classList.add('leaf-node')
  childNode.textContent = content
  parent.appendChild(childNode)
}

function removeAllChildren (element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

// 9 Selection
const raycaster = new Raycaster()
raycaster.firstHitOnly = true
const mouse = new Vector2()

function cast (event) {
  const bounds = canvas.getBoundingClientRect()

  const x1 = event.clientX - bounds.left
  const x2 = bounds.right - bounds.left
  mouse.x = (x1 / x2) * 2 - 1

  const y1 = event.clientY - bounds.top
  const y2 = bounds.bottom - bounds.top
  mouse.y = -(y1 / y2) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  return raycaster.intersectObjects(ifcModels)
}

const highlightMaterial = new MeshBasicMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff88ff,
  depthTest: false
})

let lastModel

async function pick (event) {
  const found = cast(event)[0]
  if (found) {
    const index = found.faceIndex
    lastModel = found.object
    const geometry = found.object.geometry
    const id = ifcLoader.ifcManager.getExpressId(geometry, index)
    console.log('id: ' + id)

    ifcLoader.ifcManager.createSubset({
      modelID: found.object.modelID,
      material: highlightMaterial,
      ids: [id],
      scene,
      removePrevious: true
    })
  } else if (lastModel) {
    ifcLoader.ifcManager.removeSubset(lastModel.modelID, highlightMaterial)
    lastModel = undefined
  }
}
canvas.onclick = (event) => pick(event)

// 10 Labeling
window.addEventListener('dblclick', (event) => {
  mouse.x = event.clientX / canvas.clientWidth * 2 - 1
  mouse.y = -(event.clientY / canvas.clientHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersection = raycaster.intersectObjects(ifcModels)

  if (!intersection.length) return

  const collisionLocation = intersection[0].point

  const message = window.prompt('Describe the issue')

  const container = document.createElement('div')
  container.className = 'label-container'

  const deleteButton = document.createElement('button')
  deleteButton.textContent = 'X'
  deleteButton.className = 'delete-button hidden'
  container.appendChild(deleteButton)

  const label = document.createElement('p')
  label.textContent = message
  label.classList.add('label')
  container.appendChild(label)

  const labelObject = new CSS2DObject(container)
  labelObject.position.copy(collisionLocation)
  scene.add(labelObject)

  deleteButton.onclick = () => {
    labelObject.removeFromParent()
    labelObject.element = null
    container.remove()
  }

  container.onmouseenter = () => deleteButton.classList.remove('hidden')
  container.onmouseleave = () => deleteButton.classList.add('hidden')
})

// 11 visibility
const categories = {
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCFURNISHINGELEMENT,
  IFCDOOR,
  IFCWINDOW,
  IFCPLATE,
  IFCMEMBER
}

function getName (category) {
  const names = Object.keys(categories)
  return names.find(name => categories[name] === category)
}

async function getAll (category) {
  return ifcLoader.ifcManager.getAllItemsOfType(0, category, false)
}

async function newSubsetOfType (category) {
  const ids = await getAll(category)
  return ifcLoader.ifcManager.createSubset({
    modelID: 0,
    scene,
    ids,
    removePrevious: true,
    customID: category.toString()
  })
}

const subsets = {}

async function setupAllCategories () {
  const allCategories = Object.values(categories)
  for (let i = 0; i < allCategories.length; i++) {
    const category = allCategories[i]
    await setupCategory(category)
  }
}

async function setupCategory (category) {
  subsets[category] = await newSubsetOfType(category)
  setupCheckBox(category)
}

function setupCheckBox (category) {
  const name = getName(category)
  const checkBox = document.getElementById(name)
  checkBox.addEventListener('change', (event) => {
    const checked = event.target.checked
    const subset = subsets[category]
    if (checked) scene.add(subset)
    else subset.removeFromParent()
  })
}

// 12 progress pourcentage
function setupProgressNotification () {
  const text = document.getElementById('text-container')
  ifcLoader.ifcManager.setOnProgress((event) => {
    const percent = event.loaded / event.total * 100
    const result = Math.trunc(percent)
    result < 100 ? text.innerText = 'Progress: ' + result.toString() + '%' : text.innerText = ''
  })
}

setupProgressNotification()

async function setUpMultiThreading () {
  // These paths depend on how you structure your project
  await ifcLoader.ifcManager.useWebWorkers(true, './IFCWorker.js')
}

setUpMultiThreading()

// 13 edit & export

const button = document.getElementById('button')
button.addEventListener('click',
  async function exportModel () {
    const result = prompt('introduce the new name for the model')
    const data = await ifcLoader.ifcManager.ifcAPI.ExportFileAsIFC(model.modelID)
    const blob = new Blob([data])
    const file = new File([blob], result + '.ifc')

    const link = document.createElement('a')
    link.download = result + '.ifc'
    link.href = URL.createObjectURL(file)
    document.body.appendChild(link)
    link.click()
    link.remove()
  })

// 14 Mapbox
const urlString = window.location
const url = new URL(urlString)
const index = url.searchParams.get('model')

const coordinates = models[index].coordinates
mapboxgl.accessToken = 'pk.eyJ1IjoiYWJpci1ib3Vocml6IiwiYSI6ImNsbDN0NzBqeTBkMnkzam4yaHh4cDFqa2YifQ.lKwZMQhgu7dvt5i_QkrECQ'
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  zoom: 18,
  center: coordinates,
  pitch: 60,
  bearing: -17.6,
  antialias: true
})
map.addControl(new mapboxgl.NavigationControl())

const modelOrigin = coordinates
const modelAltitude = 0
const modelRotate = [Math.PI / 2, 0, 0]

const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
  modelOrigin,
  modelAltitude
)

const modelTransform = {
  translateX: modelAsMercatorCoordinate.x,
  translateY: modelAsMercatorCoordinate.y,
  translateZ: modelAsMercatorCoordinate.z,
  rotateX: modelRotate[0],
  rotateY: modelRotate[1],
  rotateZ: modelRotate[2],
  scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
}

const customLayer = {
  id: '3d-model',
  type: 'custom',
  renderingMode: '3d',
  onAdd: function (map, gl) {
    this.camera = new Camera()
    this.scene = new Scene()

    loadModelInMap(this.scene)

    const directionalLight = new DirectionalLight(0xffffff)
    directionalLight.position.set(0, -70, 100).normalize()
    this.scene.add(directionalLight)

    const directionalLight2 = new DirectionalLight(0xffffff)
    directionalLight2.position.set(0, 70, 100).normalize()
    this.scene.add(directionalLight2)

    this.map = map

    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    })

    this.renderer.autoClear = false
  },
  render: function (gl, matrix) {
    const rotationX = new Matrix4().makeRotationAxis(
      new Vector3(1, 0, 0),
      modelTransform.rotateX
    )
    const rotationY = new Matrix4().makeRotationAxis(
      new Vector3(0, 1, 0),
      modelTransform.rotateY
    )
    const rotationZ = new Matrix4().makeRotationAxis(
      new Vector3(0, 0, 1),
      modelTransform.rotateZ
    )

    const m = new Matrix4().fromArray(matrix)
    const l = new Matrix4()
      .makeTranslation(
        modelTransform.translateX,
        modelTransform.translateY,
        modelTransform.translateZ
      )
      .scale(
        new Vector3(
          modelTransform.scale,
          -modelTransform.scale,
          modelTransform.scale
        )
      )
      .multiply(rotationX)
      .multiply(rotationY)
      .multiply(rotationZ)

    this.camera.projectionMatrix = m.multiply(l)
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.map.triggerRepaint()
  }
}

map.on('style.load', () => {
  map.addLayer(customLayer, 'waterway-label')
  const layers = map.getStyle().layers
  const labelLayerId = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout['text-field']
  ).id

  map.addLayer(
    {
      id: 'add-3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#aaa',
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'height']
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'min_height']
        ],
        'fill-extrusion-opacity': 0.6
      }
    },
    labelLayerId
  )
})

// 15 Add stats
const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const fpsLocation = 10
stats.dom.style.left = fpsLocation + 'px'
stats.dom.style.right = null
stats.dom.style.top = null
stats.dom.style.bottom = '10%'

// 16 Animation loop
const animate = () => {
  stats.begin()

  const delta = clock.getDelta()
  cameraControls.update(delta)
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)

  stats.end()

  requestAnimationFrame(animate)
}

animate()

// 17 Loading model function
async function loadModelInMap (scene) {
  const ifcLoader = new IFCLoader()
  const model = await ifcLoader.loadAsync(models[index].asset)
  ifcModels.push(model)
  scene.add(model)
}

setTimeout(() => {
  ifcLoader.load(models[index].asset, async (model) => {
    if (model) {
      ifcModels.push(model)
      await setupAllCategories()
      const ifcProject = await ifcLoader.ifcManager.getSpatialStructure(model.modelID)
      createTreeMenu(ifcProject)
    }
  })
}, 2000)

// 18 Release memory
async function releaseMemory () {
  await ifcLoader.ifcManager.dispose()
  ifcLoader = null
  ifcLoader = new IFCLoader()
  ifcModels.length = 0
}

const memory = document.getElementById('memory-button')
memory.addEventListener('click', () => releaseMemory())
