/* Data structions

point = {x,y, h1?, h2?} with h1 and h2 being {x,y}

line = [ point , point]

curve = [ point, point, point, point ] < bexier curve

shape = [ curve ] 

shapeHandles = [ 'handleType' ] where handleType of point could be: 
                                                          mirror (handles equidistance and angle)
                                                          seperate
                                                          front - ignore for now
                                                          back - ignore for now
                                                          sharp (ctrl = pt)

id structure: 
key = 

*/
let wID = new W_ID()
let processStep = 0;

let global_activeLayer;

/*
process step
  1 =
  2 =
  3 =
*/

// MODELS
const parentIdModel = new Map() // key: id, value: parentId
const childIdModel = new Map() // key: id, value:[childId]
const typeIdModel = new Map() // key: id, value: type

const ptModel = new Map() // key: id, value: {x,y}
const curveModel = new Map() // key: id, value: [pt,pt,pt,pt] id same as DOM
const shapeModel = new Map() // key: id, value: [curves] id same as DOM

const layerInfo = []
// entries should be in format {layerId,layerName}

const styleModel = new Map() // store all the styles to be reused

var actionLog = []




// DOM ELEMENTS
let svgCanvas = document.getElementById('canvas_svg')
let canvasContainer = document.getElementById('canvas_container')
let svgBack = document.getElementById('svg_back')
let svgBackground = document.getElementById('svg_background')



let rasterCanvas = document.getElementById('rasterCanvas')
let touchCanvas = document.getElementById('touchCanvas')

let uiRasterCanvas = document.getElementById('uiRasterCanvas')
let uiSvgCanvas = document.getElementById('uiSvgCanvas')


const masterDimensions = {
  bBox: svgCanvas.getBoundingClientRect(),
  width: 500,
  height:500
}



// 1 - SPOUTERS

// 1.0 DEFAULT OBJECTS

  let layer1 = "L1"
  let layer2 = "L2"
  let layer3 = "L3"
  let layer4 = "L4"
  let layer5 = "L5"


  makeLayer( layer1,'base')
  makeLayer( layer2,'basefill')
  makeLayer( layer3,'detfill')
  makeLayer( layer4,'lines')
  makeLayer( layer5,'top')


function newPt (id, x, y) {
  // generate id inside, for convenience
  const pt = {x:x, y:y}
  ptModel.set(id, pt)

  return id
}

function makeCurve (id, parentId, ptAr, optStyle) {
    if (ptAr.length !== 4) {
        throw new Error("makeCurve ptAr.length not equal 4");
    }
    
    p0 = ptModel.get( ptAr[0] )
    p1 = ptModel.get( ptAr[1] )
    p2 = ptModel.get( ptAr[2] )
    p3 = ptModel.get( ptAr[3] )


    const parent = document.getElementById(parentId)
    const ret = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathStr = `M ${p0.x},${p0.y} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
    
    // manage id
    ret.id = id
    parentIdModel.set(id, parentId)
    typeIdModel.set(id, 'curve')
    curveModel.set(id, ptAr)

    // manage DOM
    parent.appendChild (ret)
    ret.setAttribute("d", pathStr);
    ret.setAttribute("fill", 'none');

    if (optStyle != null) {
      styleCurve(id, optStyle)
    }

  return ret
}


function makeShape (id, parentId, curveAr, optStyle){

  const shapeId = id
  const parent = document.getElementById(parentId)
  const ret = document.createElementNS("http://www.w3.org/2000/svg", "g");

  // a. modify models
  parentIdModel.set(shapeId, parentId)
  childIdModel.set(shapeId, curveAr)
  typeIdModel.set(shapeId, 'shape')
  shapeModel.set(shapeId, curveAr)

  // b. add to DOM
  parent.appendChild (ret)
  ret.id = shapeId

  // c. create the 'fill' path for DOM
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const pathstring = getPathStringFromCurveAr(curveAr)

  shape.id = shapeId + '_base' // to easily access later
  shape.setAttribute("d", pathstring);
  shape.setAttribute("stroke", 'none');
  shape.setAttribute("fill", 'none');
  ret.appendChild(shape)
  

  
  curveAr.forEach((curveId)=>{
    curve = document.getElementById(curveId)

    // a. add children to model
    parentIdModel.set(curveId, shapeId)

    // b. add children to DOM
    ret.appendChild(curve)
  })

  if (optStyle != null) {
      styleShape(shapeId, optStyle)
  }

  return ret
}


function makeGroup (id, parentId){
  const parent = document.getElementById(parentId)
  const ret = document.createElementNS("http://www.w3.org/2000/svg", "g");

  // manage id
  ret.id = id
  parentIdModel.set(id, parentId)
  typeIdModel.set(id, 'group')

  // manage DOM
  parent.appendChild (ret)

  return ret
}

// how is this different from a group?
function makeLayer (id, layerName){
  const parent = svgCanvas
  const ret = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const zOrd = layerInfo.length

  // manage id
  ret.id = id
  typeIdModel.set(id, 'layer')
  layerInfo.push({layerId: id, layerName: layerName})

  // manage DOM
  parent.appendChild (ret)


  return ret
}



// 1.2 SECONDARY FUNCTIONS
function getPathStringFromCurveAr(curveAr) { // note, this is an array of curve ids
  let pathString = '';

  if (curveAr.length<1){
    throw new Error("getPathStringFromCurveAr: curveAr is empty");
  }

  // first point 
  const pt0 = ptModel.get(curveModel.get(curveAr[0])[0])
  pathString += `M ${pt0.x},${pt0.y} `

  // subsequent points
  curveAr.forEach((curveId)=>{
    const curve = curveModel.get(curveId)

    const { x: cx1, y: cy1 } = ptModel.get(curve[1])
    const { x: cx2, y: cy2 } = ptModel.get(curve[2])
    const { x: endX, y: endY } = ptModel.get(curve[3])

    pathString += `C ${cx1},${cy1} ${cx2},${cy2} ${endX},${endY} `
  })

  return pathString.trim();
}


// 1.3 TERTIARY FUNCTIONS
function getPathStringFromDirectedCurveAr(directedCurveAr) { 
  let pathString = '';

  const [curveAr, directions] = [
    directedCurveAr.map(([id]) => id),
    directedCurveAr.map(([, bool]) => bool)
  ];

  if (curveAr.length<1){
    throw new Error("getPathStringFromCurveAr: curveAr is empty");
  }

  // first point 
  const pt0 = ptModel.get(curveModel.get(curveAr[0])[0])
  pathString += `M ${pt0.x},${pt0.y} `

  // subsequent points
  curveAr.forEach((curveId, index)=>{

    const curve = curveModel.get(curveId)

    const { x: cx0, y: cy0 } = ptModel.get(curve[0])
    const { x: cx1, y: cy1 } = ptModel.get(curve[1])
    const { x: cx2, y: cy2 } = ptModel.get(curve[2])
    const { x: endX, y: endY } = ptModel.get(curve[3])

    if (directions[index] == false){
      pathString += `C ${cx2},${cy2} ${cx1},${cy1} ${cx0},${cy0} `
    } else {
      pathString += `C ${cx1},${cy1} ${cx2},${cy2} ${endX},${endY} `
    }
  })

  return pathString.trim();
}

// direction curvedAr = [ [curveId, boolean] ]
function makeShapeFill (directedCurveAr, fillColor, parentId){
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const parent = document.getElementById(parentId)

  const pathstring = getPathStringFromDirectedCurveAr(directedCurveAr)

  shape.setAttribute("d", pathstring);
  shape.setAttribute("stroke", 'none');
  shape.setAttribute("fill", fillColor);
  parent.appendChild(shape)
}




// 2 - HELPERS
/* these do NOT add to log */

// 2.1 - ADDTO

function addToShape(parentId, newCurvesAr){ // assume you are adding at end of path AR, if not you get issues

  /* key things I'm doing here
    a. add the curve (outline) to the shape
    b. update parentIdModel and childrenIdModel
    c. update the pathstring of the base shape (fill) in the parent
    d. update shapeModel

  */

  const parent = document.getElementById(parentId)

  newCurvesAr.forEach((id)=>{
    const child = document.getElementById(id)

    // check you are adding curves. if not its nonsense
    if (typeIdModel.get(id) !== 'curve'){
      throw new Error("idiot you are trying to add a non-curve to a shape");
    } 

    // a. update the DOM
    parent.appendChild(child) // change DOM

    // b. update model
    parentIdModel.set(id, parentId) 
  })

  // concat the curves the shapeModel
  const existingCurves = shapeModel.get(parentId)
  const updatedCurves = existingCurves.concat(newCurvesAr)

  // c. update pathstring
  const pathstring = getPathStringFromCurveAr(updatedCurves)
  shapeBase = document.getElementById(parentId+'_base')
  shapeBase.setAttribute('d',pathstring)

  // d. update shapeModel
  shapeModel.set(parentId, updatedCurves)

  // b. update childrenId
  childIdModel.set(parentId, updatedCurves)
}

function addToGroup(parentId, childrenAr){ 

  /* key things I'm doing here
    a. add the curve (outline) to the shape
    b. update parentIdModel and childrenIdModel
    c. update the pathstring of the base shape (fill) in the parent
    d. update shapeModel

  */

  const parent = document.getElementById(parentId)

  childrenAr.forEach((id)=>{
    const child = document.getElementById(id)


    // a. update the DOM
    parent.appendChild(child) // change DOM

    // b. update model
    childrenAr.forEach((id)=>{
      parentIdModel.set(id, parentId) 
    })


    let existingChildren = childIdModel.get(parentId)
    if ( existingChildren !=null ){
      let updatedChildren = existingChildren.concat(childrenAr)
      childIdModel.set(parentId, updatedChildren)
    } else {
      childIdModel.set(parentId, childrenAr)
    }
    
  })
}

// 2.2 - STYLE

class ArtStyle {
  constructor(options = {}) {
    this.strokeWidth = options.strokeWidth ?? null;
    this.stroke = options.stroke ?? null;
    this.fill = options.fill ?? null;
    this.lineCap = options.lineCap ?? null
  }


}

function styleShape (shapeId, style){
  children = childIdModel.get(shapeId)


  children.forEach((id)=>{
      styleCurve(id, style) 
    })

  if (style.fill != null ){
    shape = document.getElementById(shapeId+"_base")
    shape.setAttribute("fill", style.fill)
  }

}

function styleCurve (curveId, style){
  id = curveId

  if (style.strokeWidth!= null){
    document.getElementById(id).setAttribute("stroke-width", style.strokeWidth)
  }

  if (style.stroke != null ){
    document.getElementById(id).setAttribute("stroke", style.stroke)
  }

  if (style.lineCap != null ){
    shape = document.getElementById(id)
    shape.setAttribute("stroke-linecap", style.lineCap)
  }

}

// 2.3 - SHIFT LAYER
function shiftLayer(id, targetId, boolPlaceBelow= true) {
    const parent = svgCanvas

    const groupToMove = document.getElementById(id)
    const referenceGroup = document.getElementById(targetId)

    if (!(groupToMove instanceof Node) || !(referenceGroup instanceof Node)) {
        console.error("Error: 2.3 - shift layer: One or both of the elements are not valid nodes.");
        return; // Exit the function if elements are not valid nodes
    }

    if (boolPlaceBelow === true) {
        // Move down: insert the current group AFTER the next one
        parent.insertBefore(groupToMove, referenceGroup);

    } else {
        // Move up: insert the current group BEFORE the previous one
        parent.insertBefore(groupToMove, referenceGroup.nextSibling);
    }
}


// 2.4 - DELETE
function deleteCanvasItem(id, ignoreParentBool){ // bool is used internally for deleting children (so we skip removing it individually from parent)
  
  // remove from DOM
  document.getElementById(id).remove()

  // remove from type model
  switch (typeIdModel.get(id)) {
  case 'curve':
    curveModel.delete(id)
    break;
  
  case 'shape':
    shapeModel.delete(id)
    break;

  case 'group':
    groupModel.delete(id)
    break;

  default:
    ptModel.delete(id)
    break
  }
  typeIdModel.delete(id)

  // remove from parentModel
  if (ignoreParentBool != true) {
    const parent = parentIdModel.get(id)

    const siblings = childIdModel.get(parent)

    if (siblings!= null){
      siblings.filter(elems => elems !== id)
      childIdModel.set(parent, siblings) // put siblings back
    }
    
  }

  // delete all children
  const children = childIdModel.get(id)
  if ( children !=null ){
      children.forEach((childId)=>{
        deleteCanvasItem(childId, true)
      })
    }

  parentIdModel.delete(id)
  childIdModel.delete(id)

}

// 2.5 - EDITING POINTS

function renderCurve(id){
  let pts = curveModel.get(id)

  const { x: cx0, y: cy0 } = ptModel.get(pts[0])
  const { x: cx1, y: cy1 } = ptModel.get(pts[1])
  const { x: cx2, y: cy2 } = ptModel.get(pts[2])
  const { x: endX, y: endY } = ptModel.get(pts[3])

  pathString = `M ${cx0},${cy0} C ${cx1},${cy1} ${cx2},${cy2} ${endX},${endY} `

  document.getElementById(id).setAttribute("d", pathString);
}


function getMidpoint(idAr) {
    if (!Array.isArray(idAr) || idAr.length === 0) return null;

    let sumX = 0, sumY = 0, count = 0;

    for (let id of idAr) {
        let point = ptModel.get(id);
        if (!point) continue; // Skip missing points

        sumX += point.x;
        sumY += point.y;
        count++;
    }

    return count > 0 ? { x: sumX / count, y: sumY / count } : null;
}





// 3 VIEWBOX
var viewBox = {
  minX: 0,
  minY: 0,
  scale: 1
}

// 3.0 - defaults
viewbox_set(false)

/*
let sf = 0.8

touchcanvas.addEventListener("click", (ev)=>{
  let offset = getOffset(ev)
  scaleViewboxAtPivot(sf, ev.clientX-masterDimensions.bBox.x, ev.clientY-masterDimensions.bBox.y)
}) */

function viewbox_set(isForDownload){

  if (isForDownload == true){
      svgCanvas.setAttribute('viewBox',` `)
      console.log('^ above error is normal')
  } else {
      svgCanvas.setAttribute('viewBox',`${viewBox.minX} ${viewBox.minY} ${masterDimensions.width*viewBox.scale} ${masterDimensions.height*viewBox.scale}`)
  }
}

// 3.1 - Functions

function viewboxPan(x,y){
  viewBox.minX += x
  viewBox.minY -= y

  let width = masterDimensions.width
  let height = masterDimensions.height
  newVal= `${viewBox.minX} ${viewBox.minY} ${width*viewBox.scale} ${height*viewBox.scale}`

  // set viewBox
  svgCanvas.setAttribute('viewBox', newVal)
  uiSvgCanvas.setAttribute('viewBox', newVal)


   // rasterCanvas
  rasterCanvas.style.transformOrigin = 'top left';
  rasterCanvas.style.transform = `scale(${1/viewBox.scale}) translate(${-viewBox.minX}px, ${-viewBox.minY}px) `; 

}

function viewboxZoom(scale){

  viewBox.scale *= scale

  let width = masterDimensions.width
  let height = masterDimensions.height
  newVal = `${viewBox.minX} ${viewBox.minY} ${width*viewBox.scale} ${height*viewBox.scale}`

  // set viewBox
  svgCanvas.setAttribute('viewBox', newVal)
  uiSvgCanvas.setAttribute('viewBox', newVal)

  // rasterCanvas
  rasterCanvas.style.transformOrigin = 'top left';
  rasterCanvas.style.transform = `scale(${1/viewBox.scale}) translate(${-viewBox.minX}px, ${-viewBox.minY}px) `; 
  rasterSketch_updateNibSize()
}

function scaleViewboxAtPivot(amt, pivotX, pivotY) {

    scaleFactor = viewBox.scale * amt

    viewBox.minX += pivotX * ( viewBox.scale - scaleFactor)
    viewBox.minY += pivotY * ( viewBox.scale - scaleFactor)
    viewBox.scale = scaleFactor;

    // Update the viewbox
    svgCanvas.setAttribute('viewBox',`${viewBox.minX} ${viewBox.minY} ${masterDimensions.width*viewBox.scale} ${masterDimensions.height*viewBox.scale}`)
    uiSvgCanvas.setAttribute('viewBox',`${viewBox.minX} ${viewBox.minY} ${masterDimensions.width*viewBox.scale} ${masterDimensions.height*viewBox.scale}`)


    // rasterCanvas
    rasterCanvas.style.transformOrigin = 'top left';
    rasterCanvas.style.transform = `scale(${1/viewBox.scale}) translate(${-viewBox.minX}px, ${-viewBox.minY}px) `; 
    rasterSketch_updateNibSize()

}

function viewboxToLoc(x, y){
  x*= viewBox.scale
  y*= viewBox.scale

  x+=viewBox.minX
  y+=viewBox.minY


  return({x:x, y:y})
}

// 3.2 For event listeners


let viewbox_lastTouchDist = null;
let viewbox_lastTouchCenter = null;
let viewbox_isTwoFingerTouch = false;
let viewbox_lastPan = { x: 0, y: 0 };

function viewbox_touchstart(event){
  if (event.touches.length === 2) {
      viewbox_isTwoFingerTouch = true;
      viewbox_lastTouchDist = getTouchDistance(event.touches);
      viewbox_lastTouchCenter = getTouchCenter(event.touches);
  }
}

function viewbox_touchmove(event){
  if (event.touches.length === 2) {
    event.preventDefault();
    const newDist = getTouchDistance(event.touches);
    const newCenter = getTouchCenter(event.touches);
    
    if (viewbox_lastTouchDist !== null) {
        const pinchScale = newDist / viewbox_lastTouchDist;

        console.log("Pinch scale:", pinchScale);
    }
    
    if (viewbox_lastTouchCenter !== null) {
        const panX = newCenter.x - viewbox_lastTouchCenter.x;
        const panY = newCenter.y - viewbox_lastTouchCenter.y;
        console.log("Pan movement:", { x: panX, y: panY });
    }
    
    viewbox_lastTouchDist = newDist;
    viewbox_lastTouchCenter = newCenter;
  }
}

function viewbox_touchend(event){
  if (event.touches.length < 2) {
        viewbox_isTwoFingerTouch = false;
        viewbox_lastTouchDist = null;
        viewbox_lastTouchCenter = null;
    }
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

function viewbox_wheel(event){
    if (event.ctrlKey) {
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
        scaleViewboxAtPivot(1/zoomFactor, event.clientX-masterDimensions.bBox.x, event.clientY-masterDimensions.bBox.y)

    } else {
        viewboxPan( event.deltaX*viewBox.scale, -event.deltaY*viewBox.scale)
    }
}


// 3.4 TOUCHCANVAS
var touchcanvas_mouseLoc = {x:0,y:0}
var touchcanvas_mouseDisplacement = {x:0,y:0} 
//use to move things. store as global var to be accessible by other parts of program

function touchcanvas_updateMouseDisplacement(newX, newY){
  touchcanvas_mouseDisplacement.x = newX-touchcanvas_mouseLoc.x
  touchcanvas_mouseDisplacement.y = newX-touchcanvas_mouseLoc.y

  touchcanvas_mouseLoc.x = newX
  touchcanvas_mouseLoc.y = newY
}


function getOffset(e){
  let x = 0
  let y = 0
  if(e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel'){
        var touch = e.touches[0] 
        var rect = touchCanvas.getBoundingClientRect()
        x = touch.pageX - rect.left
        y = touch.pageY - rect.top



    } else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
        x = e.offsetX;
        y = e.offsetY;
    } else {
    }

  return {x: x, y: y}
}

function getOffsetAdjustToViewbox(e){
  let x = 0
  let y = 0
  if(e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel'){
        var touch = e.touches[0] 
        var rect = touchCanvas.getBoundingClientRect()
        x = touch.pageX - rect.left
        y = touch.pageY - rect.top



    } else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
        x = e.offsetX;
        y = e.offsetY;
    } else {
    }

    let adjusted = viewboxToLoc(x, y)
  return {x: adjusted.x, y: adjusted.y}
}

function touchCanvas_down(e, isTouchEvent){
  e.preventDefault();

  switch (processStep) {
    case 1:
      rasterSketch_startDrawing(e)
      break;
    
    case 2:
      pencilTool_down(e)
      break;

    case 3:
      viewbox_down(e)
      break;

    case 4: // break curves
      let loc = getOffsetAdjustToViewbox(e)
      splitCurvesAt(loc)
      break;

    default:
      if (isTouchEvent===true){
        viewbox_touchstart(e)
      }
      break;
  }
}

function touchCanvas_move(e, isTouchEvent){
  e.preventDefault();

  switch (processStep) {
    case 1:
      rasterSketch_draw(e)
      rasterSketch_updateNibLocation(e)
      rasterSketch_updateNibSize()
      break;
    
    case 2:
      pencilTool_move(e)
      break;

    case 3:
      break;

    default:
      // Code to run if expression doesn't match any case
      if (isTouchEvent===true){
        viewbox_touchmove(e)
      }
      break;
  }
}

function touchCanvas_up(e, isTouchEvent){
  switch (processStep) {
    case 1:
      rasterSketch_stopDrawing(e)
      break;
    
    case 2:
      pencilTool_up(e)
      console.log('mouseup')
      break;

    case 3:
      // Code to run if expression equals value3
      break;

    default:
      // Code to run if expression doesn't match any case
      if (isTouchEvent===true){
        viewbox_touchup(e)
      }
      break;
  }
  
  console.log('mouseup')
}

touchCanvas.addEventListener("touchstart", (e) => touchCanvas_down(e, true));
touchCanvas.addEventListener('mousedown', (e) => touchCanvas_down(e, false));

touchCanvas.addEventListener("touchmove", (e) => touchCanvas_move(e, true));
touchCanvas.addEventListener('mousemove', (e) => touchCanvas_move(e, false));

touchCanvas.addEventListener('touchend', (e) => touchCanvas_up(e,true));
touchCanvas.addEventListener('mouseup', (e) => touchCanvas_up(e,false));


touchCanvas.addEventListener('mouseenter', function(e){
  switch (processStep) {
    case 1:
      // show nib
        document.body.style.cursor = "none" // hide cursor
        rasterSketch_nib.setAttribute('stroke', rasterSketch_nibColor)
      break;
    
    case 2:
      break;

    case 3:
      // Code to run if expression equals value3
      break;

    default:
      // Code to run if expression doesn't match any case
      break;
  }
})

touchCanvas.addEventListener('mouseout', function(e){

  switch (processStep) {
    case 1:
      rasterSketch_stopDrawing(e)
      // hide nib
        document.body.style.cursor = "crosshair" // hide cursor
        rasterSketch_nib.setAttribute('stroke', 'none')
      break;
    
    case 2:
      pencilTool_out()
      break;

    case 3:
      // Code to run if expression equals value3
      break;

    default:
      // Code to run if expression doesn't match any case
      break;
  }

    console.log('mouseout')

});


touchCanvas.addEventListener('wheel', function(e){
  e.preventDefault();

  viewbox_wheel(e)
}, {passive:false});

/* add this back in later
touchCanvas.addEventListener('touchstart', function(e) {

  console.log("touched")
    e.preventDefault(); // Prevent scrolling
    startDrawing(); // Call your custom function
  }, { passive: false });
touchCanvas.addEventListener('touchmove', function(e) {
    e.preventDefault(); // Prevent scrolling
    draw(); // Call your custom function
  }, { passive: false });


touchCanvas.addEventListener('touchend', function(e) {
    e.preventDefault(); // Prevent scrolling
    rasterSketch_stopDrawing(); // Call your custom function

  }, { passive: false });
*/




// 4 - PAGE LAYOUT

// vars for 4.1
const myColumn1 = document.getElementById('myColumn1');
const myColumn2 = document.getElementById('myColumn2');

// vars for 4.2
let dragSrcEl = null;

let layertab = {} // variables to style each layertab
  layertab.negativeMargin = "0px"
  layertab.extendedMargin = "0px"
  layertab.height = "50px"

// 4.0 - Defaults

canvasContainer.setAttribute('width', masterDimensions.width)
canvasContainer.setAttribute('height', masterDimensions.height)

rasterCanvas.setAttribute('width', masterDimensions.width)
rasterCanvas.setAttribute('height', masterDimensions.height)

touchCanvas.setAttribute('width', masterDimensions.width)
touchCanvas.setAttribute('height', masterDimensions.height)

uiSvgCanvas.setAttribute('width', masterDimensions.width)
uiSvgCanvas.setAttribute('height', masterDimensions.height)

uiRasterCanvas.setAttribute('width', masterDimensions.width)
uiRasterCanvas.setAttribute('height', masterDimensions.height)

svgCanvas.setAttribute('width', masterDimensions.width)
svgCanvas.setAttribute('height', masterDimensions.height)

svgBack.setAttribute('width', masterDimensions.width)
svgBack.setAttribute('height', masterDimensions.height)



// 4.1 - LAYERS

function generateLayersInUI() {

    const myLayers = layerInfo.sort((a, b) => b.layerZOrder - a.layerZOrder);

    const list = document.getElementById("layerList");
    list.innerHTML = "";
    list.style.width = "100px";

    // syntax here is to reverse foreach
    myLayers.forEach((item, index) => {
        const div = document.createElement("div");

        const name = item.layerName
        const id = item.layerId // this is a property inside layerInfo

        // these 2 link the div to the layer
        div.id = 'ui_'+id
        div.onclick = function(){
          setActiveLayer(id)
        }


        div.setAttribute("draggable", true);        
        div.dataset.index = index;
        div.ondragstart = dragStart;
        div.ondragover = dragOver;
        div.ondrop = drop;
        div.style.height = layertab.height
        div.style.marginTop= layertab.negativeMargin
        div.style.marginBottom= layertab.negativeMargin
        

        // Set position of the outer div to relative so innerDiv can be absolutely positioned inside it
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.position = "relative"; 
        
        // Create innerDiv inside the outer div
        const innerDiv = document.createElement("div");
        innerDiv.style.border = "1px solid black";

        // Set a fixed height for innerDiv and let it remain vertically centered
        div.innerHTML = name

        div.style.border = "1px solid black"; // Adds a 5px red border

        // Hover effect: change background color on hover
        div.onmouseover = () => div.style.backgroundColor = "grey";
        div.onmouseout = () => div.style.backgroundColor = ""; // Reset

        div.onmouseout = () => div.style.backgroundColor = ""; // Reset

        div.ondragleave = () => {
            div.style.backgroundColor = "";  // Reset the background of the div
            div.style.paddingTop = "0px"
            div.style.paddingBottom = "0px"
        };

        list.appendChild(div);
    });
}

function dragStart(event) {
    dragSrcEl = event.target;
    dragSrcEl.style.opacity = "0.5"; // Make the dragged element semi-transparent
    event.dataTransfer.setData("text/plain", event.target.dataset.index);
}

function dragOver(event) {
      event.preventDefault();
}

function drop(event) {
    event.preventDefault();

    var fromIndex = dragSrcEl.dataset.index;
    var toIndex = event.target.dataset.index;

    // Call // 2.3 to shift layers on svg
    const id = layerInfo[fromIndex].layerId
    const targetId = layerInfo[toIndex].layerId
    troubleshoot = ''
    if (fromIndex<toIndex){
      boolPlaceBelow = false
    } else {
      boolPlaceBelow = true
    }


    if (fromIndex !== toIndex) {
        const movedItem = layerInfo.splice(fromIndex, 1)[0];
        layerInfo.splice(toIndex, 0, movedItem);
        generateLayersInUI();
    } else {
    }

    shiftLayer(id, targetId, boolPlaceBelow)
}


// 5 - EXPORT

async function d_downloadActionLog(_obj){
    let log = _obj
    let str = JSON.stringify(_obj, null, 2)
    const blob = new Blob([str], { type: "application/json" })

    return new Promise((resolve)=>{
        resolve(blob)
    })
}

function d_downloadSvgAsPng(svgElement, scaleFactor = 3) {
    return new Promise((resolve, reject) => {
        const width = svgElement.width.baseVal.value || svgElement.clientWidth || 300;
        const height = svgElement.height.baseVal.value || svgElement.clientHeight || 150;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
        const svgUrl = URL.createObjectURL(svgBlob);

        const svgImage = new Image();
        svgImage.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;

            const ctx = canvas.getContext("2d");
            ctx.scale(scaleFactor, scaleFactor); // Scale before drawing

            ctx.drawImage(svgImage, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create PNG blob"));
                }
                URL.revokeObjectURL(svgUrl);
            }, "image/png");
        };

        svgImage.onerror = function () {
            reject(new Error("Failed to load SVG image"));
            URL.revokeObjectURL(svgUrl);
        };

        svgImage.src = svgUrl;
    });
}

function d_downloadSvg(_svgElement) {
    const svgElement = _svgElement;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);

    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const svgImage = new Image();

    return new Promise((resolve) => { resolve(svgBlob) });

}

function d_downloadRasterAsPng(_rasterCanvas) {
  const rCanvas = _rasterCanvas

    return new Promise((resolve) => {
        rCanvas.toBlob(function (blob) {
            resolve(blob);
        }, "image/png");
    });
}

function d_downloadAllAsZip() {
    const zip = new JSZip();

    viewbox_set(true) // set canvas viewbox properly

    Promise.all([
        d_downloadSvgAsPng(svgCanvas),
        d_downloadSvg(svgCanvas),
        d_downloadRasterAsPng(rasterCanvas),
        d_downloadActionLog(actionLog)
    ])
    .then((blobs) => {
        // Add each blob as a file in the zip
        zip.file("canvas.png", blobs[0]);
        zip.file("canvas.svg", blobs[1]);
        zip.file("rasterCanvas.png", blobs[2]);
        zip.file("actionLog.json", blobs[3]);

        // Generate the zip file and trigger the download
        zip.generateAsync({ type: "blob" }).then(function (content) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "canvas_files.zip";
            link.click();
            URL.revokeObjectURL(link.href);
        });
    });


    viewbox_set(false) // put it back to correct zoom and pan
}


async function d_overwrite(){
    actionLog = await loadJsonFromFile()
    actionlog_replay()
}


// function to load JSON from a file
async function loadJsonFromFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) {
                reject("No file selected");
                return;
            }
            try {
                const text = await file.text();
                resolve(JSON.parse(text)); // Return parsed JSON
            } catch (error) {
                reject("Error reading file: " + error);
            }
        });

        input.click(); // Trigger the file picker
    });
}


// 6 - ACTIONLOG
function actionlog_resetCanvas(_svgCanvas, _svgBack, _rasterCanvas){
  const svg = _svgCanvas
  const canvas = _rasterCanvas
  const back = _svgBack
  const ctx = canvas.getContext('2d');

  // Remove all children except svg_back
  Array.from(svg.children).forEach(child => {
      if (child !== back) {
          svg.removeChild(child);
      }
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  testing_setup()

}

function actionlog_newEntry(_fn, _args, _boolGetSpeed){
  let ret = {}
  ret.fn = _fn
  ret.args = _args

  if (_boolGetSpeed == true ){
    speed = actionlogTimer_stop()
    ret.speed = speed
  }

  actionLog.push( ret )
}

function actionlog_replay() {
  
  // clear everything
  actionlog_resetCanvas(svgCanvas, svgBack, rasterCanvas)

  // make copy
  const actionLogCopy = actionLog.slice();

  for (const action of actionLogCopy) {
    const { fn, args, speed } = action;

      if (!args) { 
      // no arguments, just run
      console.log(`actionlog: to run ${fn}`)
      window[fn]()
      

      } else {

        // Call the function by name with the arguments
        if (typeof window[fn] === "function") {
            console.log(`actionlog: to run ${fn} with arguments`)
            window[fn](...args);// Spread the arguments into the function
        } else {
            console.error(`Function ${fn} not found.`);
        }
      }
    }
  }

// 6.1 - ACTIONLOG TIMER
let actionlogTimer;

function actionlogTimer_start(){
  actionlogTimer = Date.now()
}

function actionlogTimer_stop(){
  let ret = Date.now() - actionlogTimer
  actionlogTimer = Date.now()

  return ret
}


// 7 - TOOLS


// 7.1 - RASTERSKETCH 
const rasterSketch_ctx = rasterCanvas.getContext('2d');
let rasterSketch_isDrawing = false;
let rasterSketch_lastX = 0;
let rasterSketch_lastY = 0;
let rasterSketch_drawingMode = 'draw'
let rasterSketch_capturedPoints = []


// Drawing settings
rasterSketch_ctx.strokeStyle = '#00000';
rasterSketch_ctx.lineWidth = 2;
rasterSketch_ctx.lineCap = 'round';


// nib
let rasterSketch_nib = document.createElementNS("http://www.w3.org/2000/svg", "circle")
  rasterSketch_nibColor = 'black'
  rasterSketch_nibSize = 2

  rasterSketch_nib.setAttribute("r", rasterSketch_nibSize)
  rasterSketch_nib.setAttribute("fill", "none")
  rasterSketch_nib.setAttribute("stroke", "none") // hide for now
  rasterSketch_nib.setAttribute("stroke-width", "0.5px")
  rasterSketch_nib.setAttribute("cx", 100)
  rasterSketch_nib.setAttribute("cy", 100)
  uiSvgCanvas.appendChild(rasterSketch_nib)


function rasterSketch_startDrawing(e) {
  console.log("start draw")
    rasterSketch_isDrawing = true;

    // make nib invisible
    rasterSketch_nib.setAttribute("stroke", "none")


    let offset = getOffsetAdjustToViewbox(e)
    offsetX = offset.x
    offsetY = offset.y
    console.log(`touch started ${offsetX}, ${offsetY}`)


    rasterSketch_lastX = offsetX
    rasterSketch_lastY = offsetY;
    rasterSketch_capturedPoints.push({x:offsetX, y:offsetY})

    actionlogTimer_start() // so we can collect the speed later
}

function rasterSketch_draw(e) {
    if (rasterSketch_isDrawing == false ){
      return
    }
 
    // modify for touch events to not use offsetX
    let offset = getOffsetAdjustToViewbox(e)
    offsetX = offset.x
    offsetY = offset.y

    rasterSketch_capturedPoints.push({x:offsetX, y:offsetY})

    rasterSketch_ctx.beginPath();
    rasterSketch_ctx.moveTo(rasterSketch_lastX, rasterSketch_lastY);
    rasterSketch_ctx.lineTo(offsetX, offsetY);
    rasterSketch_ctx.stroke();
    
    rasterSketch_lastX = offsetX
    rasterSketch_lastY = offsetY;

}

function rasterSketch_stopDrawing() {
  // make nib visible
    rasterSketch_nib.setAttribute("stroke", "black")

    // check if we are actually drawing first 
    if (rasterSketch_isDrawing == false ){
      return
    }
    rasterSketch_isDrawing = false;    

    let args = [rasterSketch_capturedPoints, rasterSketch_ctx.lineWidth, rasterSketch_drawingMode]
    actionlog_newEntry('rasterSketch_replayStroke', args, true)

    rasterSketch_capturedPoints=[]
}

function rasterSketch_replayStroke(points, lineWidth, mode) {

  //let [points, lineWidth, mode] = _args;
  //console.log(_args)
  console.log(points)

  console.log(mode)

  // stroke settings
  rasterSketch_ctx.lineWidth = lineWidth;
  drawingMode = mode;
    if (mode === 'erase') {
        rasterSketch_ctx.globalCompositeOperation = 'destination-out';
    } else {
        rasterSketch_ctx.globalCompositeOperation = 'source-over';
    }

  rasterSketch_ctx.beginPath();

  let pt1 = points[0]
  rasterSketch_ctx.moveTo(pt1.x, pt1.y);

  points.forEach((pt)=>{
    rasterSketch_ctx.lineTo(pt.x, pt.y);
  })

  rasterSketch_ctx.stroke();
}



function rasterSketch_setMode(mode) {
    rasterSketch_drawingMode = mode;
    if (mode === 'erase') {
        rasterSketch_ctx.globalCompositeOperation = 'destination-out';
    } else {
        rasterSketch_ctx.globalCompositeOperation = 'source-over';
    }
    console.log('Drawing mode:', rasterSketch_drawingMode);

}


function rasterSketch_updateNibLocation(e){

  let loc = getOffsetAdjustToViewbox(e)

  rasterSketch_nib.setAttribute("cx", loc.x)
  rasterSketch_nib.setAttribute("cy", loc.y)
}

function rasterSketch_updateNibSize(){
  //rasterSketch_nib.setAttribute("r", rasterSketch_nibSize/2/viewBox.scale)
}

function rasterSketch_setNibSize(size) {
    rasterSketch_nibSize = size
    rasterSketch_ctx.lineWidth = size;
    document.getElementById('nibValue').textContent = size;
    console.log('Nib size:', size);
    rasterSketch_updateNibSize()

    actionLog.push({ tool:'rasterDraw', fn: "rasterSketch_setNibSize", args: [size] })
}



// 7.2 PENCIL TOOL
const pencilTool_ctx = uiRasterCanvas.getContext('2d');
const pencilTool_updateInterval = 10; // 100 milliseconds = 0.1 seconds

let pencilTool_isDrawing = false;
let pencilTool_rawpoints = []; // note pts are in format {x,y}
let pencilTool_curves = [];

let pencilTool_strokestyle = new ArtStyle({
    strokeWidth: 3,
    stroke: "black",
    fill: "none",
    lineCap: "round"
});

let pencilTool_shapestyle = new ArtStyle({
    fill: "green",
});




// Start recording
function pencilTool_down(e){
    pencilTool_isDrawing = true;


    // Reset pencilTool_rawpoints array
    pencilTool_rawpoints = []; 
      
    // Clear canvas
    pencilTool_ctx.clearRect(0, 0, uiRasterCanvas.width, uiRasterCanvas.height);
    
    // Start new path
    pencilTool_ctx.beginPath();
    pencilTool_ctx.strokeStyle = 'red';
    pencilTool_ctx.lineWidth = 0.5;
    
    // Get initial point
    let offset = getOffsetAdjustToViewbox(e)
    let uiOffset = getOffset(e)
    
    pencilTool_ctx.moveTo(uiOffset.x, uiOffset.y);
    pencilTool_rawpoints.push({x:offset.x, y:offset.y});

    // time
    actionlogTimer_start()
}

// Record pencilTool_rawpoints while drawing
function pencilTool_move(e){
    if (!pencilTool_isDrawing) return;

    let offset = getOffsetAdjustToViewbox(e)
    let uiOffset = getOffset(e)

    // Draw line
    pencilTool_ctx.lineTo(uiOffset.x, uiOffset.y);
    pencilTool_ctx.stroke();
    pencilTool_rawpoints.push({x:offset.x, y:offset.y})

}

// Stop recording and show results
function pencilTool_up(e, _boolIsReplay) {
    let layer = global_activeLayer
    pencilTool_isDrawing = false;
    let style = pencilTool_strokestyle
    
    let rawPoints = W_PointsToBezier.getCurveFromPoints(pencilTool_rawpoints)
    let pointsToAdd = []

    rawPoints.forEach((elem)=>{
        id = wID.getNew()
        pointsToAdd.push(id)
        newPt(id,elem.x, elem.y)
    })

    let curveId = wID.getNew()
    makeCurve (curveId, layer, pointsToAdd, style)

    // add curve to ar
    pencilTool_curves.push(curveId)

    // clear UI line
    pencilTool_ctx.clearRect(0, 0, uiRasterCanvas.width, uiRasterCanvas.height);

    // add to actionlog
    actionlog_newEntry('pencilTool_replayStroke', [curveId, rawPoints, pointsToAdd, style, layer])
}

function pencilTool_replayStroke( _curveId, _ptAr, _ptIdAr, _style, _layer){

  console.log('input is')

  console.log(_curveId)
    console.log(_ptAr)

  console.log(_ptIdAr)
   console.log(_style)

  let pointsToAdd = []

  _ptAr.forEach((elem, i)=>{
        id = _ptIdAr[i]
        pointsToAdd.push(id)
        newPt(id,elem.x, elem.y)
    })

  makeCurve (_curveId, _layer, pointsToAdd, _style)
}

function pencilTool_replayEndShape(_id, _layer, _curves, _style){
  id = _id
  layer = _layer
  curves = _curves
  layer = _layer
  style = _style

  makeShape (id, layer, curves, style)
}

// Stop recording if mouse leaves canvas
function pencilTool_out() {
    if (pencilTool_isDrawing) {
        pencilTool_isDrawing = false;
        console.error('Stroke interrupted. Try again.');
    }
}

function pencilTool_endShape(boolAddFill){
    let id = wID.getNew()

    let style;
    if (boolAddFill=== true){
      style = pencilTool_shapestyle
      style.fill = colorbar_currentFill

    } else {
      style = pencilTool_strokestyle
    }
    makeShape (id, global_activeLayer, pencilTool_curves, style)

    actionlog_newEntry('pencilTool_replayEndShape', [id, global_activeLayer, pencilTool_curves, style])


    pencilTool_curves = []
    // select current shape
    //selection.push(pencilTool.svgShape)
}

function pencilTool_deleteLastStroke(){
  let id = pencilTool_curves.pop() // removes last item from pencilTool_curves
  deleteCanvasItem(id) // removes item from DOM and models
}


// 7.3 LINEFILLER TOOL


function getAllPathendPoints(){
  let pts = []
  curveModel.forEach((curve) => {
    pts.push( curve[0])
    pts.push( curve[3])
    });

  return pts
}

function findClusters(idArray, maxDistance) {
    const graph = new Map(); // Adjacency list for connections
    const visited = new Set();
    const clusters = [];

    // Build adjacency list (graph)
    for (let i = 0; i < idArray.length; i++) {
        let id1 = idArray[i];
        let p1 = ptModel.get(id1);
        if (!p1) continue;

        for (let j = i + 1; j < idArray.length; j++) {
            let id2 = idArray[j];
            let p2 = ptModel.get(id2);
            if (!p2) continue;

            let distance = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            if (distance <= maxDistance) {
                if (!graph.has(id1)) graph.set(id1, []);
                if (!graph.has(id2)) graph.set(id2, []);
                graph.get(id1).push(id2);
                graph.get(id2).push(id1);
            }
        }
    }

    // Find clusters using DFS
    function dfs(node, cluster) {
        if (visited.has(node)) return;
        visited.add(node);
        cluster.push(node);
        (graph.get(node) || []).forEach(neighbor => dfs(neighbor, cluster));
    }

    // Identify clusters
    for (let id of idArray) {
        if (!visited.has(id) && graph.has(id)) {
            let cluster = [];
            dfs(id, cluster);
            clusters.push(cluster);
        }
    }

    return clusters;
}

function findCurvesInCluster(cluster) { // note HIGHLY inefficient, it goes through all curves
    const curvesInCluster = new Set();

    cluster.forEach(ptId => {
        curveModel.forEach((curve, curveId) => {
            if (curve.includes(ptId)) {
                curvesInCluster.add(curveId);
            }
        });
    });

    return [...curvesInCluster];
}


// Geometry-based function to detect loops in a cluster of curves
function detectLoopsInCurves(curveIds) {
    const visitedCurves = new Set();
    const loops = [];

    curveIds.forEach(curveId => {
        if (!visitedCurves.has(curveId)) {
            const loop = traverseCurveLoop(curveId, visitedCurves);
            if (loop.length > 0) {
                loops.push(loop);
            }
        }
    });

    return loops;
}

// 7.1.1 helper functions

function traverseCurveLoop(startCurveId, visitedCurves) {
    // Traverse and detect loops by checking if start/end points of curves connect to form a cycle
    const stack = [startCurveId];
    const path = [];
    const pathPoints = new Set();  // To track visited points

    while (stack.length > 0) {
        const curveId = stack.pop();
        const curve = curveModel.get(curveId);

        // Check if the curve is already visited
        if (visitedCurves.has(curveId)) {
            continue;
        }

        visitedCurves.add(curveId);
        path.push(curveId);
        pathPoints.add(curve[0]); // Add start point to visited points
        pathPoints.add(curve[1]); // Add end point to visited points

        // Check for curves that share points (start/end) and add to the stack
        curveModel.forEach((otherCurve, otherCurveId) => {
            if (curveId !== otherCurveId && !visitedCurves.has(otherCurveId)) {
                if (sharePoint(curve, otherCurve)) {
                    stack.push(otherCurveId);
                }
            }
        });
        
        // If we loop back to the start, we have a cycle
        if (pathPoints.has(curve[0]) && pathPoints.has(curve[1])) {
            return path;
        }
    }

    return [];
}

function sharePoint(curve1, curve2) {
    let pA0 = curveModel.get(curve1)[0]
    return (curve1[0] === curve2[0] || curve1[0] === curve2[1] || curve1[1] === curve2[0] || curve1[1] === curve2[1]);
}


// used to map curves to graph adjacency chart
function findIndicesForValues(arr, x1, x2) {
    let index1 = -1; // Default value if x1 is not found
    let index2 = -1; // Default value if x2 is not found

    console.log(x1)
    console.log(x2)
    console.log(arr)

    for (let i = 0; i < arr.length; i++) {
        if (arr[i].includes(x1) && index1 === -1) {
          console.log('found1')
            index1 = i; // Set the index for x1
        }
        if (arr[i].includes(x2) && index2 === -1) {
          console.log('found2')
            index2 = i; // Set the index for x2
        }
        
        // Exit early if both are found
        if (index1 !== -1 && index2 !== -1) {
          console.log('broke')
            break;
        }
    }

    return { index1, index2 }; // Return the indices of both values
}


function findCycles(nodes, edges) {
    const graph = new Map();

    // Build adjacency list
    for (const [u, v, edgeId] of edges) {
        if (!graph.has(u)) graph.set(u, []);
        if (!graph.has(v)) graph.set(v, []);
        graph.get(u).push([v, edgeId, true]);
        graph.get(v).push([u, edgeId, false]);
    }

    const visited = new Set();
    const stack = [];
    const cycles = [];
    const direction = [];
    const cycleSet = new Set(); // To avoid duplicate cycles

    // DFS to detect cycles
    function dfs(node, parent, edgeHistory) {
        if (visited.has(node)) {
            const cycleStartIndex = stack.findIndex(([n]) => n === node);
            if (cycleStartIndex !== -1) {
                const cycleEdges = edgeHistory.slice(cycleStartIndex);
                const cycleId = cycleEdges.join('-');
                if (!cycleSet.has(cycleId)) {
                    cycleSet.add(cycleId);
                    cycles.push(cycleEdges);
                }
            }
            return;
        }

        visited.add(node);
        stack.push([node, parent]);

        for (const [neighbor, edgeId, direction] of graph.get(node)) {
            if (edgeId !== parent) {
                dfs(neighbor, edgeId, [...edgeHistory, [edgeId, direction]]);
            }
        }

        stack.pop();
    }

    // Start DFS from every unvisited node
    for (const node of nodes) {
        if (!visited.has(node)) {
            dfs(node, null, []);
        }
    }


    return cycles; // in format of [ [[edgeId, directionBool]] ]
}



function testing(){

  pts = getAllPathendPoints()
  //ui_showPoints(pts)



  let clusters = findClusters(pts, 10)

  clusters.forEach((cluster, index)=>{
    
    ui_showPoints(cluster, getRandomColor())

    let item = getMidpoint(cluster)

    cluster.forEach((pt)=>{
      ptModel.set(pt, item)
    })
  })


  // change all curves to adjacency table
  let adjacencyAr = [] // format of [ [node1,node2, curveId] ]
  curveModel.forEach((curve,id) =>{
    console.log(id)
    console.log(curve)
    let adjacency = findIndicesForValues(clusters, curve[0], curve[3])

    if (adjacency.index1 !== -1 && adjacency.index2 !== -1) {
        // Both values are found
        adjacencyAr.push([adjacency.index1, adjacency.index2, id])
    }
  })

  let nodes = []
  clusters.forEach((elem,index)=>{
    nodes.push(index)
  })



  let cycles = findCycles(nodes,adjacencyAr)
  if (cycles.length <  1){
    //console.error('no cycles found')
    return
  }

  let cyclesRanked = cycles.sort((a, b) => b.length - a.length);

  cyclesRanked.forEach( (directedCurveAr)=>{

    makeShapeFill(directedCurveAr, getRandomColor(),global_activeLayer)
  })


  /*
  let allCurves = Array.from(curveModel.keys())
  allCurves.forEach((curve)=>{
    renderCurve(curve)
  })*/

}



// Hill climbing algorithm to find the intersection points
function hillClimbIntersection(curve1, curve2) {
    const maxIterations = 1000;
    const stepSize = 0.01;
    const tolerance = 0.0001;
    
    let intersectionPoints = [];

    // Iterate over both curves using hill climbing
    for (let t1 = 0.05; t1 < 1; t1 += 0.05) {  // Skip 0 and 1 for t1
        for (let t2 = 0.05; t2 < 1; t2 += 0.05) {  // Skip 0 and 1 for t2
            let point1 = cubicBezierAtT(curve1, t1);
            let point2 = cubicBezierAtT(curve2, t2);
            let bestDistance = distanceBetweenPoints(point1, point2);
            
            let currentT1 = t1, currentT2 = t2;

            for (let i = 0; i < maxIterations; i++) {
                // Move along the curves
                let nextT1 = Math.min(Math.max(currentT1 + (Math.random() - 0.5) * stepSize, 0.05), 0.95); // Avoid 0 and 1
                let nextT2 = Math.min(Math.max(currentT2 + (Math.random() - 0.5) * stepSize, 0.05), 0.95); // Avoid 0 and 1

                let nextPoint1 = cubicBezierAtT(curve1, nextT1);
                let nextPoint2 = cubicBezierAtT(curve2, nextT2);

                let newDistance = distanceBetweenPoints(nextPoint1, nextPoint2);

                if (newDistance < bestDistance) {
                    bestDistance = newDistance;
                    currentT1 = nextT1;
                    currentT2 = nextT2;
                }

                // If the distance is small enough, consider it as an intersection
                if (bestDistance < tolerance) {
                    intersectionPoints.push({ t1: currentT1, t2: currentT2, point: bezierPoint(curve1, currentT1) });
                    break;
                }
            }
        }
    }

    return intersectionPoints;
}





function findTForPoint(curve, targetPoint, epsilon = 1e-6) {
    let t0 = 0, t1 = 1;
    let maxIterations = 100;
    let iteration = 0;

    // Binary search
    while (iteration < maxIterations) {
        const tMid = (t0 + t1) / 2;
        const pointOnCurve = cubicBezierAtT(curve, tMid);
        const dist = distanceBetweenPoints(pointOnCurve, targetPoint);

        if (dist < epsilon) {
            return tMid;
        } else if (pointOnCurve.x < targetPoint.x) {
            t0 = tMid;
        } else {
            t1 = tMid;
        }

        iteration++;
    }

    // If no solution is found within the max iterations, return a default value
    return (t0 + t1) / 2;
}


function subdivideBezier(rawCurve, t) {
    let curve = rawCurve
    if (curve.length !== 4) {
        throw new Error("Curve must have exactly 4 points (cubic Bézier).");
    }
    
    const [p0, p1, p2, p3] = curve;
    
    // First level interpolation
    const p01 = lerpPoint(p0, p1, t);
    const p12 = lerpPoint(p1, p2, t);
    const p23 = lerpPoint(p2, p3, t);
    
    // Second level interpolation
    const p012 = lerpPoint(p01, p12, t);
    const p123 = lerpPoint(p12, p23, t);
    
    // Final midpoint
    const p0123 = lerpPoint(p012, p123, t);
    
    return [
        [p0, p01, p012, p0123], // First half
        [p0123, p123, p23, p3]  // Second half
    ];
}

function lerpPoint(pA, pB, t) {
    return {
        x: (1 - t) * pA.x + t * pB.x,
        y: (1 - t) * pA.y + t * pB.y
    };
}

function findClosestT(testPoint, curve) {
  let bestT = 0;
  let minDist = Infinity;
  let step = 0.05; // Step size for sampling t from 0 to 1

  for (let t = 0; t <= 1; t += step) {
    let bezierPoint = cubicBezierAtT(curve, t);

    let dist = distanceBetweenPoints(testPoint, bezierPoint);
    if (dist < minDist) {
      minDist = dist;
      bestT = t;
    }
  }

  return [bestT, minDist];
}

function roundToDecimal(num, places) {
  let factor = Math.pow(10, places);
  return Math.round(num * factor) / factor;
}

function cubicBezierAtT(curve, t) {
    const [p0, p1, p2, p3] = curve;
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
}

function distanceBetweenPoints(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}



function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}





// 7.3.2b
  // 

// get the paths of the fill (area surrounded)



// TO-DO SELECT 


function ui_showAllPoints(optionalFill){
  ptModel.forEach((point) => {
        let fill = optionalFill || "green"
        ui_showpoint(point, fill)
    });
}

function ui_showPoints( ptAr, optionalFill){
  let fill = optionalFill || "green"

  ptAr.forEach((id) => {
        point = ptModel.get(id)
        ui_showpoint(point, fill)

    });
}

function ui_showpoint(point, fill){
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 5); // Adjust radius as needed
    circle.setAttribute("fill", fill); // Adjust color as needed
    circle.setAttribute("stroke", "red"); // Adjust color as needed

    circle.setAttribute("cursor", "pointer"); // Indicate draggable
    
    let isDragging = false;

    circle.addEventListener("mousedown", (event) => {
        isDragging = true;
        touchCanvas.addEventListener("mousemove", (e)=>onMouseMove(e,circle));
        touchCanvas.addEventListener("mouseup", (e)=>onMouseUp(circle));
    });

    function onMouseMove(event, target) {
        if (!isDragging) return;
        const rect = touchCanvas.getBoundingClientRect();
        const loc = getOffset(event)

        circle.setAttribute("cx", loc.x);
        circle.setAttribute("cy", loc.y);
    }

    function onMouseUp(target) {
        isDragging = false;
        target.removeEventListener("mousemove", onMouseMove);
        target.removeEventListener("mouseup", onMouseUp);
    }

    touchCanvas.appendChild(circle);
}

function ui_clearCanvas(){
  while (touchCanvas.firstChild) {
    touchCanvas.removeChild(touchCanvas.firstChild);
  }

  while (uiSvgCanvas.firstChild) {
    uiSvgCanvas.removeChild(uiSvgCanvas.firstChild);
  }
}

// TO-DO SELECT TESTING




// TO-DO TOOLBAR UI

 
function setProcessStep(step) {
    console.log("set process")

    // Set the new step
    processStep = step;

    // Remove highlight from all steps
    document.querySelectorAll('.toolbar div').forEach(div => {
      div.classList.remove('highlight');
    });


    /*
    // change hide mouse circle
    rasterPenNib.setAttribute("stroke","none")
    */

    // for sketch: Show/hide sketch controls based on step
    const sketchControls = document.getElementById('sketchControls');
    const blockOutControls = document.getElementById('blockOutControls');

    document.body.style.cursor = "auto" // show cursor
    rasterSketch_nib.setAttribute('stroke', 'none') // hide rastersketch_nib


    if (step == 1) {
        sketchControls.style.display = 'block';
    } else {
        sketchControls.style.display = 'none';
    }

    if (step == 2) {
        blockOutControls.style.display = 'block';
    } else {
        blockOutControls.style.display = 'none';
    }


    // Highlight the selected step
    document.getElementById('step' + step).classList.add('highlight');

  }



//TO-DO COLOR BAR

let colorbar_currentPalette; // [9 colors]
let colorbar_currentFill;

let colorbar_holder = document.createElement("div")
  colorbar_holder.style.display = "flex";
  colorbar_holder.id = 'colorbar_holder'
  colorbar_holder.style.width = '100%'
  colorbar_holder.style.height = 'auto'
  colorbar_holder.style.backgroundColor = 'grey'
  colorbar_holder.style.flexWrap = "wrap";
  colorbar_holder.style.gap = '10px'; // Space between elements
  colorbar_holder.style.alignItems = "flex-start"; // Align elements to the top

myColumn1.appendChild(colorbar_holder)


function createColorBar (palette){
  palette.forEach((color,index)=>{

    const div = document.createElement("div");
        div.id = 'uiColorbox_'+index
        div.style.width = '30px'
        div.style.height = '30px'
        div.style.backgroundColor = color
        div.style.display = "block";

        colorbar_holder.appendChild(div)

        div.onclick = function(){          
          const index = parseInt(this.id.split('_')[1], 10);
          console.log(colorbar_getColor(index))
          colorbar_currentFill= colorbar_getColor(index)
        }

  })
}

function colorbar_getColor(index){
  return colorbar_currentPalette[index]
}

function rerenderColorBar (palette){
  palette.forEach((color,index)=>{
    const div = document.getElementById('uiColorbox_'+index)
    div.fill = "blue"
  })
}


//TO-DO COLOR BAR TESTING
colorbar_currentPalette = ['red','orange','yellow','lime','green','blue','purple','pink','black']

createColorBar (colorbar_currentPalette)

// TESTING ZONE

let style1 = new ArtStyle({
    strokeWidth: 10,
    stroke: "black",
    fill: "none"
});

let style2 = new ArtStyle({
    strokeWidth: 10,
    stroke: "black",
    fill: "green"
});


let points = [
    newPt(wID.getNew(),50, 50),
    newPt(wID.getNew(),100, 100),
    newPt(wID.getNew(),100, 150),
    newPt(wID.getNew(),150, 200),
];

let points2 = [
    newPt(wID.getNew(),150, 200),
    newPt(wID.getNew(),100, 100),
    newPt(wID.getNew(),200, 200),
    newPt(wID.getNew(),300, 50),
];

let points3 = [
    newPt(wID.getNew(),300, 50),
    newPt(wID.getNew(),150, 200),
    newPt(wID.getNew(),300, 200),
    newPt(wID.getNew(),400, 50),
];

let myStyle = new ArtStyle({
    strokeWidth: 10,
    stroke: "red",
    fill: "green"
});

let myStyle2 = new ArtStyle({
    strokeWidth: 5,
    stroke: "blue",
    fill: "purple"
});

let myStyle3 = new ArtStyle({
    strokeWidth: 5,
    stroke: "green",
    fill: "none"
});

let myStyle4 = new ArtStyle({
    strokeWidth: 5,
    stroke: "yellow",
    fill: "none"
});

let curve1 = wID.getNew()
let curve2 = wID.getNew()
let curve3 = wID.getNew()

makeCurve ( curve1, 'canvas_svg', points, myStyle)
makeCurve ( curve2, 'canvas_svg', points2, myStyle)
makeCurve ( curve3, 'canvas_svg', points3, myStyle2)

let shape1 = wID.getNew()
let shape2 = wID.getNew()
makeShape (shape1, "L1", [curve1,curve2])
makeShape (shape2, "L1", [curve2,curve3], myStyle2)

let group1 = wID.getNew()
makeGroup (group1, "L1", [curve2,curve3], myStyle2)



generateLayersInUI();



global_activeLayer = "L3"


function getRawCurve(id){
  const pts = curveModel.get(id)
  const rawCurve = pts.map(pt => ptModel.get(pt))
  return rawCurve
}

function makePoints( rawPointAr ){
  let ret = []

  rawPointAr.forEach( (rawPt)=>{
    let id = wID.getNew()
    newPt(id, rawPt.x, rawPt.y)
    ret.push(id)
  })

  return ret
}

let curve2Points = curveModel.get(curve2)
const rawcurve2Points = curve2Points.map(pt => ptModel.get(pt));

function splitCurvesAt( target_rawPoint){

  curveToMake = [] // consists of rawpoints. don't put this inside the foreach, if not you'll get an infinite loop

  curveModel.forEach((curve, curveId)=>{


    const rawCurve = getRawCurve(curveId)

    // check intersection
    let [tValue, minDist] = findClosestT(target_rawPoint,rawCurve)

    if (minDist<30 ){
      const [splitCurvePts1, splitCurvePts2] = subdivideBezier(rawCurve, tValue);

      curveToMake.push(splitCurvePts1)
      curveToMake.push(splitCurvePts2)

      // delete the curve
      deleteCanvasItem(curveId)
    }
  })

  curveToMake.forEach((rawCurve)=>{
    let id = wID.getNew()

    makeCurve ( id, 'canvas_svg', makePoints(rawCurve), {stroke: getRandomColor(),strokeWidth:5})

  })

}

processStep = 4

let intersectTol = 5
let intersect1= hillClimbIntersection( getRawCurve(curve3) , getRawCurve(curve2))
//let intersect2= findIntersection( getRawCurve(curve2) , getRawCurve(curve1), tolerance = intersectTol)

console.log(intersect1)
//console.log(intersect2)

//ui_showpoint(intersect1.intersection)


/*
intersect1.forEach((pt)=>{
  ui_showpoint(pt)
})
intersect2.forEach((pt)=>{
  ui_showpoint(pt)
})*/



