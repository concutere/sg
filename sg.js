function SGData(id, set, val) {
  this.id = id;
  this.set = set;
  this.val = val;
}

/* data should be of the form 

  [ { id : string, set : number, val : number } ]
  
*/
function SG() {
  var create = function(data, svgEl) {
    this.data = data;
    this.el = svgEl;
    //todo parameterize these
    this.height = 500;
    this.rowh = 20; //todo make relative to font size / text element height
    this.textw = 200;
    this.slopew = 100;
    this.gutterw = 5;
    this.font = 'Cabin, Arial, Helvetica'; 
    this.fontSize = 14;
    this.fontColor = 'darkslategray';
    this.strokew = 0.5;
    this.lineColor = 'lightslategray';
    
    /* this.sets should have sub-arrays grouped by set, like so
       not being used yet, but useful for data-binding by column
      [ // sets
        [ //set
          { //SGData
            ...
          }, ...
        ], ...
      ]
      
    */
    // this.sorted is sorted by set, then val, then id
    this.sorted = [];
  
    this.msort = []; 
    this.minv;
    this.maxv;
    init(this);
    if(svgEl != undefined) {
      while (svgEl.lastChild) {
        svgEl.removeChild(svgEl.lastChild);
      }
      this.graph(this);
    }
   
    return this;
  }

  // set up sorted data, check bounds ...
  function init(sg) {
    // msort is an all in one big val-sorted list (for bounds checking)
    sg.msort = sg.data.sort(//SGData.prototype.sortVal
              function(self, other) {
                return self.val - other.val;
              });
    sg.maxh = sg.msort[sg.msort.length-1].val;
    sg.minh = sg.msort[0].val;
    sg.mind = 1;  // todo loop through and calc this properly!!!
    sg.scope = sg.maxh - sg.minh; //effective linear range size
    sg.scale = sg.scope / sg.mind; // max rows we can effectively fit
    sg.sorted = sg.msort.sort(//SGData.prototype.sortSet
                    function(self, other) {
                      if (self.set == other.set) {
                        if(self.val == other.val) {
                          if (self.id < other.id) {
                            return -1;
                          }
                          else if (self.id > other.id) {
                            return 1;
                          }
                          else {
                            return 0;
                          }
                        }
                        else {
                          return self.val - other.val;
                        }
                      }
                      else {
                        return self.set - other.set;
                      }
                    });
    
    return sg;
  }
 
  SG.prototype.graph = function(sg) {
    var x = 5;
    var y = sg.rowh;
    var set;
    var lastval;
    var el;
    var lastset = [];
    var thisset = [];
    var lastx = 0;
    var g;
    var maxtw = 0; //sg.textw;
    var lastmax = sg.textw;
    var longest;
    for (var s = 0; s < sg.sorted.length; s++) {
      var d = sg.sorted[s];
      if (isNaN(set) || d.set > set) {
        //new set, new column, new g
        if(!isNaN(set)) {
          lastx = x;
          x += maxtw + sg.slopew + sg.gutterw * 2;
          //maxtw = sg.textw;
        }
        set = d.set;
        y = sg.rowh; 
        lastval = undefined;
        lastset = thisset;
        thisset = [];
        lastmax = maxtw;
        maxtw = 0;
        g = sub(this.el, 'g');
      }
      if (isNaN(lastval) || lastval < d.val) {
        y += sg.rowh * ((isNaN(lastval) ? sg.maxh : lastval) - d.val) / sg.mind; // todo precalc row heights for data objects
        lastval = d.val;
        el = sub(g, 'text');
      }
      at(el, 'id', s);
      at(el,'x',x);
      at(el, 'y',y);
      at(el, 'text-length', sg.textw);
      at(el, 'font-family', sg.font);
      at(el, 'font-size', sg.fontSize);
      at(el, 'fill', sg.fontColor);            /*
      should the following conditional block be moved
      to a pre-render loop to minimize draw lag 
      for older browsers with slow getBBox??
      */
      if (el.textContent.length > 0)
        el.textContent = el.textContent + ', ' + d.id;
      else
        el.textContent = '(' + d.val + ') ' + d.id;
      
      this.el.appendChild(el);
      var tw = el.getComputedTextLength();
      if (maxtw < tw) maxtw = tw;
        
      thisset.push({'id':d.id, 'x':x, 'y':y});
      
      if (s == sg.sorted.length - 1 || sg.sorted[s+1].set != set)
        if(lastset.length > 0)
          this.drawSlopes(thisset, lastset, lastmax, sg.rowh, sg.gutterw, sg.lineColor, sg.strokew);

    }
    
    /* todo resize based on contents? scale to fit? 
       dynamically create from params?
    */
    var el = sg.el;
    var bb = sg.el.getBBox();
    var sx = bb.width + bb.x;
    var sy = bb.height + bb.y;
    if(isNaN(el.style.height) || el.style.height <= sy) {
      el.style.height = sy + 5;
    }
    if(isNaN(el.style.height) || el.style.width <= sx) {
      el.style.width = sx + 5;
    }
    //*/    
  }
  
  SG.prototype.drawSlopes = function(curr, last, width, height, gutter, color, strokeWidth) {
    if(curr.length < 1 || last.length < 1) return;
    //var g = sub(svgEl, 'g');
    for(var c = 0; c < curr.length; c++) {
      for(var l = 0; l < last.length; l++) {
        if(curr[c].id == last[l].id) {
          var line = sub(this.el, 'line');
          at(line, 'x1', last[l].x + width + gutter);
          at(line, 'x2', curr[c].x - gutter);
          at(line, 'y1', last[l].y - height/6); // todo the factor of 6 here feels really arbitrary, may break with widely varying font sizes
          at(line, 'y2', curr[c].y - height/6);
          at(line, 'stroke', color);
          at(line, 'stroke-width', strokeWidth);
        }
      }
    }
  }

  function sub(parent, name, leaveParentless) {
    var el = document.createElementNS("http://www.w3.org/2000/svg",name);
      if (leaveParentless !== true) 
        parent.appendChild(el);
    return el;
  }
  function at(parent, name, value) {
    parent.setAttribute(name, value);
    return parent;
  }
  
  if (arguments.length > 1) {
    create.apply(this,arguments);
  }
}
