//todo not used yet ...
function SGData(id, set, val) {
  this.id = id;
  this.set = set;
  this.val = val;
}


function SG() {
/***
 SG constructor params, all passed on to create
  var sg = new SG(data, svgEl, settings, setLabels)

  data: should be of the form 
    data = [ { 'id' : string,   //name for data row. used to find pairs to connect with slopelines
                'set' : number, //the linear-ranged value to associate columns (ie year). 
                                //TODO add setLabels option to params
                'val' : number 
              } ]
    
  svgEl: where to draw. the height & weight will be changed via style. don't set any viewBox on the element unless you want to clip it!
    //TODO dynamically generate this?
  
  settings: name/value pairs of text/line element & related attributes. 
            listed below with default values. 
            make sure values denoted as number are always numeric!
            todo parse element directives in names like 'line:stroke'? or 'id:width' (where 'id' may represent any SGData attribute or select drawing elements like line & slope)?

      settings = {
        'fontSize'   : 14,                        
        'fontFamily' : 'Cabin, Helvetica, Arial', /*if you use webfonts you need to wait for them to download 
                                                    before building the graph or the text column adjustments 
                                                    will be off. setting a close-in-size fallback in fontFamily
                                                    can sometimes serve as an acceptable workaround
                                                  /*
        'fontColor'  : 'darkslategray',
        'textWidth'  : 100,                       //currently serves as a min-width
                                                  //todo make fixed width or drop the param?
        'gutterWidth': 6,
        'slopeWidth' : 100,                      //the width of the slopeline columns
        'lineSize'   : 1,                      //the thickness of the slopelines, 
        'lineColor'  : 'lightslategray'
      }
***/
  var create = function(data, svgEl, settings) {
    this.data = data;
    this.el = svgEl;
    setSettings(this, settings);
    init(this);
    //clear anything that might get in the way
    //layer another element w/ opaque background if you need to preserve
    if(svgEl != undefined) {
      while (svgEl.lastChild) {
        svgEl.removeChild(svgEl.lastChild);
      }
      this.graph(this);
    }
   
    return this;

    function setSettings(sg, settings) {
      if (settings==undefined || settings.length < 1) {
        settings = defaultSettings();
      }
      //todo move non-calc'd items to CSS?
      sg.fontSize = parseInt(isNaN(settings.fontSize)   ? 14 : settings.fontSize);
      sg.rowh = sg.fontSize + 5; // is this fudge good enough?
      sg.textw = parseInt(isNaN(settings.textWidth)     ? 200 : settings.textWidth);
      sg.slopew = parseInt(isNaN(settings.slopeWidth)   ? 100 : settings.slopeWidth);
      sg.gutterw = parseInt(isNaN(settings.gutterWidth) ? 12 : settings.gutterWidth);
      sg.font = isEmpty(settings.fontFamily)            ? 'Cabin, Arial, Helvetica' : settings.fontFamily; 
      sg.fontColor = isEmpty(settings.fontColor)        ? 'darkslategray' : settings.fontFamily;
      sg.strokew = parseFloat(isNaN(settings.lineSize)  ? 1 : settings.lineSize);
      sg.lineColor = isEmpty(settings.lineColor)        ? 'lightslategray' : settings.lineColor;
      
      sg.maxTextWidth = parseInt(isNaN(settings.maxTextWidth) ? 0 : settings.maxTextWidth); // 0 (or any < 1) defaults to no max
    }
  }
  
  // set up sorted data, check bounds ...
  function init(sg) {
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

    // msort is an all in one big val-sorted list (for bounds checking)
    sg.msort = sg.data.sort(//SGData.prototype.sortVal
              function(self, other) {
                return self.val - other.val;
              });
    sg.maxh = sg.msort[sg.msort.length-1].val;
    sg.minh = sg.msort[0].val;
    for (var i = 1; i < sg.msort.length; i++) {
      if (isNaN(sg.mind) || (sg.msort[i].val != sg.msort[i-1].val && sg.msort[i].val - sg.msort[i-1].val < sg.mind)) {
        sg.mind = sg.msort[i].val - sg.msort[i-1].val;
      }
    }
    if(isNaN(sg.mind)) {
      sg.mind = 1;
    }
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
  
  SG.prototype.waitToLoad = function(waitOnMe, handler) {
    if (!(waitOnMe || handler)) return;
    if (typeof waitOnMe === 'String') waitOnMe = document.getDocumentById(waitOnMe);
    if (waitOnMe) {
      waitOnMe.onload = handler;
    }
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
      at(el, 'fill', sg.fontColor);            
      /*
      should the following conditional block be moved
      to a pre-render loop to minimize draw lag 
      for older browsers with slow getBBox??
      */
      if (el.textContent.length > 0) {
        el.textContent = el.textContent + ', ' + d.id;
      } else {
        el.textContent = '(' + d.val + ') ' + d.id;
      }
      
      this.el.appendChild(el);
      var tw = el.getComputedTextLength();
      if (maxtw < tw) {
        maxtw = tw;
      }
        
      thisset.push({'id':d.id, 'x':x, 'y':y});
      
      if (s == sg.sorted.length - 1 || sg.sorted[s+1].set != set) {
        if(lastset.length > 0) {
          this.drawSlopes(thisset, lastset, lastmax, sg.rowh, sg.gutterw, sg.lineColor, sg.strokew);
          }
        }
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
  
  function defaultSettings() {
    return {
          'fontSize'   : '14',                        
          'fontFamily' : 'Cabin, Helvetica, Arial, sans-serif',
          'fontColor'  : 'darkslategray',
          'textWidth'  : '100',                     
          'gutterWidth': '6',
          'slopeWidth' : '100',                     
          'lineSize'   : '0.5',                     
          'lineColor'  : 'lightslategray'
    };
  }
  
  function isEmpty(text) {
    return text == undefined || text.toString().length <  1;
  }
  
  if (arguments.length > 1) {
    create.apply(this,arguments);
  }
}
