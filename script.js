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
  MeshBasicMaterial
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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

// 1 Scene
const scene = new Scene()
const canvas = document.getElementById('three-canvas')

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
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.set(-2, 0, 0)

// 8 IFC loading

// Sets up optimized picking
const input = document.getElementById('file-input')
const ifcLoader = new IFCLoader()

ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast)

const ifcModels = []

input.addEventListener(
  'change',
  async () => {
    const file = input.files[0]
    const url = URL.createObjectURL(file)
    const model = await ifcLoader.loadAsync(url)
    // scene.add(model)
    ifcModels.push(model)
    await setupAllCategories()
    const ifcProject = await ifcLoader.ifcManager.getSpatialStructure(model.modelID)
    createTreeMenu(ifcProject)
  }
)

// Tree view

const toggler = document.getElementsByClassName('caret')
for (let i = 0; i < toggler.length; i++) {
  toggler[i].onclick = () => {
    toggler[i].parentElement.querySelector('.nested').classList.toggle('active')
    toggler[i].classList.toggle('caret-down')
  }
}

// Spatial tree menu

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

  childNode.onmouseenter = () => {
    ifcLoader.ifcManager.selector.prepickIfcItemsByID(0, [node.expressID])
  }
  childNode.onclick = async () => {
    ifcLoader.ifcManager.selector.pickIfcItemsByID(0, [node.expressID])
  }
}

function removeAllChildren (element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

const raycaster = new Raycaster()
raycaster.firstHitOnly = true
const mouse = new Vector2()

function cast (event) {
  // Computes the position of the mouse on the screen
  const bounds = canvas.getBoundingClientRect()

  const x1 = event.clientX - bounds.left
  const x2 = bounds.right - bounds.left
  mouse.x = (x1 / x2) * 2 - 1

  const y1 = event.clientY - bounds.top
  const y2 = bounds.bottom - bounds.top
  mouse.y = -(y1 / y2) * 2 + 1

  // Places it on the camera pointing to the mouse
  raycaster.setFromCamera(mouse, camera)

  // Casts a ray
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
    console.log(id)

    /* const buildings = await ifcLoader.ifcManager.getAllItemsOfType(found.object.modelID, IFCBUILDING, true);
        const building = buildings[0];
        console.log(building); */

    // logging properties
    const props = await ifcLoader.ifcManager.getItemProperties(found.object.modelID, id)
    console.log(props)
    const pSets = await ifcLoader.ifcManager.getPropertySets(found.object.modelID, id)
    console.log(pSets)

    for (const pSet of pSets) {
      const realValues = []
      for (const prop of pSet.HasProperties) {
        const id = prop.value
        const value = await ifcLoader.ifcManager.getItemProperties(found.object.modelID, id)
        realValues.push(value)
      }
      pSet.HasProperties = realValues
    }
    console.log(pSets)

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

// 9 Labeling
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

// 10 visibility
const categories = {
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCFURNISHINGELEMENT,
  IFCDOOR,
  IFCWINDOW,
  IFCPLATE,
  IFCMEMBER
}

// Gets the name of a category
function getName (category) {
  const names = Object.keys(categories)
  return names.find(name => categories[name] === category)
}

// Gets the IDs of all the items of a specific category
async function getAll (category) {
  return ifcLoader.ifcManager.getAllItemsOfType(0, category, false)
}

// Creates a new subset containing all elements of a category
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

// Stores the created subsets
const subsets = {}

async function setupAllCategories () {
  const allCategories = Object.values(categories)
  for (let i = 0; i < allCategories.length; i++) {
    const category = allCategories[i]
    await setupCategory(category)
  }
}

// Creates a new subset and configures the checkbox
async function setupCategory (category) {
  subsets[category] = await newSubsetOfType(category)
  setupCheckBox(category)
}

// Sets up the checkbox event to hide / show elements
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

// 11 progress pourcentage
function setupProgressNotification () {
  const text = document.getElementById('progress-text')
  ifcLoader.ifcManager.setOnProgress((event) => {
    const percent = event.loaded / event.total * 100
    const result = Math.trunc(percent)
    text.innerText = result.toString()
  })
}

setupProgressNotification()

async function setUpMultiThreading () {
  // These paths depend on how you structure your project
  await ifcLoader.ifcManager.useWebWorkers(true, './IFCWorker.js')
}

setUpMultiThreading()

// 12 Animation loop
// Add stats
const stats = new Stats()
stats.showPanel(2)
document.body.appendChild(stats.dom)

const fpsLocation = 10
stats.dom.style.left = fpsLocation + 'px'
stats.dom.style.right = null
stats.dom.style.top = null
stats.dom.style.bottom = '10%'

const animate = () => {
  stats.begin()

  controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)

  stats.end()

  requestAnimationFrame(animate)
}

animate()
