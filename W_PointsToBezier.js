const W_PointsToBezier = (() => {

	

	function removeDuplicatePencilPoints (_points){
	  let ret = []
	  let lastPoint = {x:1234567, y:7654321}

	  _points.forEach( (elem,index) =>{
	    if (elem.x !== lastPoint.x || elem.y !== lastPoint.y){
	      ret.push(elem)
	      lastPoint = elem
	    }
	  })

	  return ret
	}

	function xyArrayFromPoints(_points){
	  let retX = []
	  let retY = []

	  _points.forEach((elem)=>{
	    retX.push(elem.x)
	    retY.push(elem.y)
	  })

	  return {x: retX, y: retY}
	}



	//from chatgpt
	var bezier = (params, t) => {
	  const [P0_x, P1_x, P2_x, P3_x] = params.slice(0, 4);
	  const [P0_y, P1_y, P2_y, P3_y] = params.slice(4);

	  const x = Math.pow(1 - t, 3) * P0_x + 3 * Math.pow(1 - t, 2) * t * P1_x + 3 * (1 - t) * Math.pow(t, 2) * P2_x + Math.pow(t, 3) * P3_x;
	  const y = Math.pow(1 - t, 3) * P0_y + 3 * Math.pow(1 - t, 2) * t * P1_y + 3 * (1 - t) * Math.pow(t, 2) * P2_y + Math.pow(t, 3) * P3_y;

	  return { x, y };
	};

	// not using, but may be useful in p_p_pointsToCurve
	function thinOutEndsOfArray(points){
	  let len = points.length
	  let q1 = math.round(len/3)
	  let q3 = math.round(len*2/3)
	  let inc = math.round(len/8)
	  if (inc < 2){
	    inc = 2
	  }

	  let ret = []

	  for (let i = 0; i < 10; i+=2) {
	    console.log(i)
	  }

	  for (let i = 0; i < q1; i+=2) {
	    ret.push(points[i])
	  }
	  for (let i = q1; i < q3; i+=1) {
	    ret.push(points[i])
	  }
	  for (let i = q1; i <= len; i+=2) {
	    ret.push(points[i])
	  }

	  return ret
	}

	// not using, but may be useful in p_p_pointsToCurve
	function addExtraPoints(points){
	  let increment = 20
	  let xSection; // places to add in new points at
	  let ySection;

	  let startPt = points[0]
	  let ret = []

	  ret.push(points[0])
	  // for each point
	  for (let pt = 0; pt< points.length -1; pt++){
	    // get slope 
	    let slope = { x: points[1].x-points[0].x,
	                  y: points[1].y-points[0].y}

	    let magnitude = math.sqrt (slope.x*slope.x + slope.y*slope.y)

	    if (magnitude > 2* increment){
	      
	      xSection = slope.x/magnitude * increment
	      ySection = slope.y/magnitude * increment

	      for (let i = 0; i<= magnitude; i+= increment){
	        x = points[0].x + xSection
	        y = points[0].y + ySection
	        ret.push( points[0])
	      }
	    }
	    return ret
	  }
	}



	function getEvenlySpacedPoints(points, numPoints) {
	    // Helper function to calculate distance between two points
	    function distance(p1, p2) {
	        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
	    }

	    // Step 1: Calculate distances between consecutive points
	    let distances = [];
	    let totalLength = 0;
	    for (let i = 0; i < points.length - 1; i++) {
	        const d = distance(points[i], points[i + 1]);
	        distances.push(d);
	        totalLength += d;
	    }

	    // Step 2: Determine the spacing interval
	    const interval = totalLength / (numPoints - 1);

	    // Step 3: Interpolate evenly spaced points
	    let evenlySpacedPoints = [points[0]];
	    let currentDistance = 0;
	    let nextInterval = interval;
	    for (let i = 0; i < points.length - 1; i++) {
	        const p1 = points[i];
	        const p2 = points[i + 1];
	        const segmentLength = distances[i];

	        while (currentDistance + segmentLength >= nextInterval) {
	            const t = (nextInterval - currentDistance) / segmentLength;
	            const newX = p1.x + t * (p2.x - p1.x);
	            const newY = p1.y + t * (p2.y - p1.y);
	            evenlySpacedPoints.push({ x: newX, y: newY });
	            nextInterval += interval;
	        }

	        currentDistance += segmentLength;
	    }

	    // Ensure the last point is included
	    if (evenlySpacedPoints.length < numPoints) {
	        evenlySpacedPoints.push(points[points.length - 1]);
	    }

	    return evenlySpacedPoints;
	}

	//from gpt
	// Objective function to minimize (sum of squared errors)
	var makeObjective2D = function (targetFunc,xlist,ylist){
	  var objective = (params) => {
	    let total = 0.0;
	    const n = xlist.length;
	    for (let i = 0; i < n; i++) {
	      // Use t = i / (n-1) to get points evenly spaced along the curve
	      const t = i / (n - 1);
	      const bez = targetFunc(params, t);
	      const delta_x = bez.x - xlist[i];
	      const delta_y = bez.y - ylist[i];
	      total += delta_x * delta_x + delta_y * delta_y; // Sum of squared errors
	    }
	    return total;
	  };
	  return objective
	}
	


	function getCurveFromPoints(points){

	    let curve;// to return

	    // get parameters
	    let cleanPoints = removeDuplicatePencilPoints(points)
	        cleanPoints = getEvenlySpacedPoints(cleanPoints, 10) 
	    
	    //console.log(`cleanpoints length = ${cleanPoints.length}`)
	    let splitAr = xyArrayFromPoints(cleanPoints)

	    let objective = makeObjective2D(bezier,splitAr.x,splitAr.y)
	    var initial = [0,0,0,0,0,0,0,0];
	    var minimiser = numeric.uncmin(objective,initial);
	    let solution = minimiser.solution
	    //plotSpline(solution, bezier,ctx)


	    let pt1 = points[0], 
	        pt2 ={x:solution[1],y:solution[5]},
	        pt3 ={x:solution[2],y:solution[6]},
	        pt4 = points[points.length-1]
	             

	    curve = [pt1, pt2, pt3, pt4 ] 

	    return curve
	  }


	return { getCurveFromPoints }; // Export only the main function
})();



/*
CODE SNIPPETS NOT USING

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// this is from stackexchange
var makeObjective = function(targetFunc,xlist,ylist) {
  var objective = function(params) {
    var total = 0.0;
    for(var i=0; i < xlist.length; ++i) {
      var resultThisDatum = targetFunc(params, xlist[i]);
      var delta = resultThisDatum - ylist[i];
      total += (delta*delta);
    }
    return total;
  };
  return objective;
};




// Function to select evenly spaced points from chatgpt
function selectEvenlySpacedPoints(points) {
  if (points.length < 2) return points; // Need at least two points to calculate distance

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += getDistance(points[i-1], points[i]);
  }

  // Calculate the interval (distance between each of the 10 points)
  let interval = totalDistance / (points.length*3);

  let selectedPoints = [];
  let currentDistance = 0;
  let index = 0;
  selectedPoints.push(points[0]); // First point is always included

  // Iterate through the points and select evenly spaced ones
  for (let i = 1; i < points.length; i++) {
    let segmentDistance = getDistance(points[i-1], points[i]);
    currentDistance += segmentDistance;

    // If we've reached the interval, add the point
    while (currentDistance >= interval * (selectedPoints.length)) {
      selectedPoints.push(points[i]);
    }
  }

  return selectedPoints;
}



var cubic = function(params,x) {
  return params[0] * x*x*x +
    params[1] * x*x +
    params[2] * x +
    params[3];
};


// plots for testing
function plotCubic(params, cubicFunction, ctx) {
  ctx.strokeStyle = "red"
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.beginPath(); // Start the path

  ctx.moveTo(0, cubicFunction(params, 0)); // Move to the starting point

  for (let x = 0; x < ctx.canvas.width; x++) {
    const y = cubicFunction(params, x);
    ctx.lineTo(x, y); // Draw a line to the next point
  }

  ctx.stroke(); // Render the path
}

function plotSpline(params, bezierFunction, ctx){
  ctx.strokeStyle = "red"
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.beginPath(); // Start the path

  ctx.moveTo( bezierFunction(params, 0).x, bezierFunction(params, 0).y); // Move to the starting point

  for (let t = 0; t < 1; t+=0.05){
    let curve = bezierFunction(params, t)
    ctx.lineTo(curve.x,curve.y)
  }

  ctx.stroke(); // Render the path
}

var cubicBezier = function(params,x) {
  return  params[0] * (1-x)*(1-x)*(1-x) +
          params[1] * (1-x)*(1-x)*3*x
          params[2] * (1-x)*3*x*x
          params[3] * x*x*x
};
*/
