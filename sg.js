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
        'lineSize'   : 1,                        //the thickness of the slopelines, 
        'lineColor'  : 'lightslategray'
      }
***/
(function() {
  var SG = window['SG'] = function(data, svgEl, settings) {
    var sg = {
      'data':data,
      'el':svgEl,
    };
    setSettings(sg, settings);
    init(sg);
    //clear anything that might get in the way
    //layer another element w/ opaque background if you need to preserve
    if(svgEl != undefined) {
      while (svgEl.lastChild) {
        svgEl.removeChild(svgEl.lastChild);
      }
      
      if (sg.waitFont) {
        graphWithFonts(sg.font, sg.waitFont);
      }
      else {
        graph(sg);
      }
    }
   
    return this;

    function setSettings(sg, settings) {
      if (settings==undefined || settings.length < 1) {
        settings = defaultSettings();
      }
      //todo move non-calc'd items to CSS?
      sg.textw = parseInt(isNaN(settings.textWidth)           ? 200 : settings.textWidth);
      sg.slopew = parseInt(isNaN(settings.slopeWidth)         ? 100 : settings.slopeWidth);
      sg.gutterw = parseInt(isNaN(settings.gutterWidth)       ? 12 : settings.gutterWidth);
      sg.resize =  settings.resize === true || settings.resize == 'true' || settings.resize == 'resize';
      if (!isEmpty(settings.waitFont)) {
        sg.waitFont = settings.waitFont; /***
                                           no default, but "yourWebFont, 'Courier New'" usually works well 
                                           if you have smart defaults in the main fontFamily setting
                                         ***/
      }

      sg.fontSize = parseInt(isNaN(settings.fontSize)         ? 14 : settings.fontSize);
      sg.rowh = sg.fontSize + 5; // is this fudge good enough?
      sg.headh = sg.rowh * 2; // todo param
	  
      sg.font = isEmpty(settings.fontFamily)                  ? 'Cabin,Helvetica, Arial, sans-serif' : settings.fontFamily; 
      sg.fontColor = isEmpty(settings.fontColor)              ? 'darkslategray' : settings.fontColor;
      sg.strokew = parseFloat(isNaN(settings.lineSize)        ? 1 : settings.lineSize);
      sg.lineColor = isEmpty(settings.lineColor)              ? 'lightslategray' : settings.lineColor;
      
      sg.textWidth = parseInt(isNaN(settings.textWidth)       ? 0 : settings.textWidth); // 0 (or any < 1) defaults to no max
      sg.height = parseInt(isNaN(settings.height)             ? 600 : settings.height);
      sg.lineOpacity = parseFloat(isNaN(settings.lineOpacity) ? 1 : settings.lineOpacity);
      sg.sortVals = isEmpty(settings.sortVals)                ? 'up' : settings.sortVals; // for vals, also: 'down', 'flat'

      sg.offsetX = isNaN(settings.offsetX)                    ? 0 : settings.offsetX;
      sg.offsetY = isNaN(settings.offsetY)                    ? 0 : settings.offsetY;
      if(!isEmpty(settings.rowCurve)) sg.rowCurve = settings.rowCurve;
      if (settings.debugGrid === true) sg.debugGrid = true;
      if (!isEmpty(settings.doc)) sg.doc = settings.doc;
      if (!isNaN(settings.width)) sg.width = settings.width;
      if (!isNaN(settings.decimals)) sg.decimals = settings.decimals;
      if (!isEmpty(settings.lineColorHi)) sg.lineColorHi = settings.lineColorHi;
      if (!isEmpty(settings.lineColorLo)) sg.lineColorLo = settings.lineColorLo;
      sg.lineColorHiThreshold = isNaN(settings.lineColorHiThreshold) ? 0 : settings.lineColorHiThreshold;
      sg.lineColorLoThreshold = isNaN(settings.lineColorLoThreshold) ? 0 : settings.lineColorLoThreshold;
    }

    /*** using waitFont setting
      ie graphWithFonts("Cabin, Helvetica, Arial", "Cabin, 'Courier New'") 
      even though Cabin doesn't produce exactly the same text size
      its close enough to Cabin and far enough from Courier New
    ***/
    function graphWithFonts(main, wait, txt) {
      var az = isEmpty(txt) ? 'abcdefghijklmnopqrstuvwxyz' : txt;
      var fonts = [main, wait];
      var cnt = 0;
      inGraphWithFonts();
      function inGraphWithFonts() {
        var vals = [];
        for (var i = 0; i < fonts.length; i++) {
          var font = fonts[i];
          var el = newEl(svgEl, 'text', 'font-family', font, 'font-size',   12);
          el.textContent = az;
          vals.push(el.getComputedTextLength());

          svgEl.removeChild(el);
        }
        //todo increase total wait time (at least for mobile slowness)?
        if (++cnt < 100 && vals[0] != vals[1]) {
          window.setTimeout(inGraphWithFonts, 11);
        }
        else {
          graph(sg);
        }
      }
    }
  
    // set up sorted data, check bounds ...
  function init(sg) {
    var offsetr = (sg.offsetY > 0 ? sg.offsetY + sg.rowh : sg.rowh * 3); //todo this doesn't feel right, too much fudge
    sg.maxr = (sg.height - offsetr )/ sg.rowh; //take extra row to account for current item

    var valsort =(function() {
      if (sg.sortVals == 'up') return function(a,b) { return a.val - b.val;};
      else if (sg.sortVals == 'down') return function(a,b) { return b.val - a.val;};
      else /*if (sg.sortVals == 'flat')*/ return function(a,b) { return 0;};
    })();
    // msort is an all in one big val-sorted list (for bounds checking)
    msort(sg);
    function msort(sg) {
      sg.msort = sg.data.sort(valsort);
      if (sg.sortVals != 'down') {
        sg.maxv = sg.msort[sg.msort.length-1].val;
        sg.minv = sg.msort[0].val;
      }
      else {
        sg.minv = sg.msort[sg.msort.length-1].val;
        sg.maxv = sg.msort[0].val;
      }
      for (var i = 1; i < sg.msort.length; i++) {
        //find the minimum delta between vals
        var diff = Math.abs(sg.msort[i].val - sg.msort[i-1].val);
        if (diff != 0 && (isNaN(sg.mind) || diff < sg.mind)) {
          sg.mind = diff;
        }
        if (diff != 0 && (isNaN(sg.maxd) || diff > sg.maxd)) {
          sg.maxd = diff;
        }
      }
      if(isNaN(sg.mind)) {
        sg.mind = 1;
      }
      if(isNaN(sg.maxd)) {
        sg.maxd = 1;
      }
      
      return sg;
    }
    
    // sorted is sorted by set, then val, then id
    sorted(sg);
    function sorted(sg) {
      sg.sorted = sg.msort.sort(
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
                            return valsort(self, other);
                          }
                        }
                        else {
                          return self.set - other.set;
                        }
                      });
                      
      sg.setc = 1; // # of sets/columns
      sg.sorted[0].s = 1;
      var unqid = [sg.sorted[0].id]; 
      var unqval = [sg.sorted[0].val];
      var unqr = unqidr = 1; // unique rows
      var dupval = [];
      var dupr = 0;
      for (var i = 1; i < sg.sorted.length; i++) {
        if (unqid.indexOf(sg.sorted[i].id) < 0) unqid.push(sg.sorted[i].id);
        if (unqval.indexOf(sg.sorted[i].val) < 0) unqval.push(sg.sorted[i].val);
        if (sg.sorted[i-1].set != sg.sorted[i].set) {
          sg.setc++;
          if(i == sg.sorted.length - 1) {
            sg.setc++;
          }
        }

      }

    
      unqr = unqidr = unqid.length - 1;
      
      if (sg.maxr < unqr) {
        //data won't fit to scale, need to compress
        sg.forceRowY = true;
        sg.maxr = unqr;
        sg.height = Math.ceil(sg.rowh * sg.maxr) + sg.rowh * 2; //padding/set headers
        sg.forced = (sg.maxv - sg.minv) / unqr;
      }
      else  {
        sg.forced = (sg.maxv - sg.minv) / sg.maxr;
      }
      
      return sg;
    }
    
    return sg;
  }

  //show row lines & units for debugging positioning
  function drawGrid(el, start, r, h, w, min, d, x, y, useLog) {
    var maxi = h/r - 1;
    for(var i = 1; i < maxi; i++) {
      var y = start + i * r;
      newEl(el,'line','x1',x,'x2',w,'y1',y, 'y2', y, 'stroke', '#bbb','stroke-width','.5');
      var t = newEl(el,'text','x',x,'y',y, 'fill','#bbb');
      t.textContent = i;
      t = newEl(el,'text','x',800,'y',y, 'fill','#bbb');
      var val = parseFloat(min + (d < 0 ? (maxi - i - 1) * -d : (i-1) * d)).toFixed(2);
      if (useLog) {
        t.textContent = Math.log(val);
      }
      else {
        t.textContent = val;
      }
    }
  }
  function graph(sg) {
    if(sg.debugGrid) drawGrid(sg.el, sg.rowh * 2,sg.rowh, sg.height, 800, sg.minv, (sg.sortVals == 'up' ? 1 : -1) * sg.forced, sg.offsetX, sg.offsetY, sg.rowCurve == 'log');
    
    var x = sg.offsetX > 0 ? sg.offsetX : 10; //todo param padding
    var y = sg.offsetY > 0 ? sg.offsetY : sg.rowh * 2; // padding + headers
    var oy = y;
    var set;
    var lastval;
    var el;
    var lastset = [];
    var thisset = [];
    var lastx = 0;
    var g;
    var maxtw = 0; 
    var lastmax = sg.textw;
    var longest;
    var setcnt = 0;
    var dupcnt = 0;
    var predupy = y;
    var dupoff = 0;
    
    docBox(sg.el, sg.doc, sg.width, sg.offsetX, sg.offsetY, y, sg.rowh+4, sg.font, sg.fontSize+4, sg.fontColor);
    
    for (var s = 0; s < sg.sorted.length; s++) {
      var d = sg.sorted[s];
      if (isNaN(set) || d.set > set) {
        //new set, new column, new g
        if(!isNaN(set)) {
          lastx = x;
          x += maxtw + sg.slopew + sg.gutterw * 2;
        }
        set = d.set;
        y = oy; 
        lastval = undefined;
        lastset = thisset;
        thisset = [];
        lastmax = maxtw;
        maxtw = sg.textWidth;
        g = newEl(sg.el, 'g');
      }

      if (!isNaN(lastval)) {
        //todo dup checking currently misses dup adjustments on last 2 rows in dataset!!
        if (lastval == d.val) {
          if(dupcnt++ == 0) {
            dupcnt++;
            predupy = y;
          }
        }
        else if (dupcnt > 0) {
          var diff = sg.rowh * (dupcnt-1)/2;          
          var ydiff = Math.abs(y - predupy);

          /*if (diff + sg.rowh * dupcnt > ydiff ) {
            diff = Math.abs(thisset[thisset.length-(dupcnt)].y - predupy) - (sg.sortVals == 'up' ? sg.rowh : -sg.rowh); 
          }*/
         if (diff > 0) {
            var startat = thisset.length-1;
            var upto = thisset.length-dupcnt;
            var step = function(v) { return v-1;}
            for (var i = startat; i >= upto; i = step(i)) {
              thisset[i].y -= diff;
              at(thisset[i].el, 'y', thisset[i].y);
              dupoff += diff;
            }
            fitPriorRows(thisset,upto,sg.rowh,oy);
          }
          dupcnt = 0;
          predupy = y;
        }
        
      }
      else {
        dupcnt = 0;
        predupy = y + sg.rowh;
      }
      
      if (sg.forceRowY || dupcnt > 0) {
        y += sg.rowh;
      }
      else {
        var topv = (sg.sortVals == 'up' ? sg.minv : sg.maxv);
        var tmprow = (Math.abs(topv - d.val) / sg.forced); // todo precalc row heights for data objects;
        if (sg.rowCurve == 'log') tmprow = Math.log(tmprow);
        tmprow = (tmprow+1) * sg.rowh;
        if (tmprow < sg.rowh) {
          tmprow = sg.rowh;
        }
        else if (dupcnt <= 0 && dupoff > 0) {
          var reduceBy = (dupoff > sg.rowh) ? sg.rowh : dupoff;
          tmprow -= reduceBy;
          dupoff -= reduceBy;
        }
        y = tmprow + oy;
        if (thisset.length > 0 && y < thisset[thisset.length-1].y + sg.rowh)
          y = thisset[thisset.length-1].y + sg.rowh;
      }
      
      //todo move this to repass?
      if (!sg.resize && y > sg.height) {
        y = sg.height;
      }
      
      lastval = d.val;
         
      //todo val & id get their own text el
      el = newEl(g, 'text', 
        'id', s, 'y', y, 'x', x,
         'font-family', sg.font, 'font-size', sg.fontSize, 'fill', sg.fontColor);

      var val = formatVal(sg.rowCurve == 'log' ? Math.log(d.val) : d.val, sg.decimals);
      function formatVal(val, places) {
        if(isNaN(places) || places <= 0) {
          return parseInt(val);
        }
        else {
          return parseFloat(val).toFixed(places);
        }
      }
      
      //todo separate id & val into separate els for better alignment
      if (setcnt == 0) {
        // align right, id before val
        el.textContent = d.id + ' ' + val;
      }
      else if (setcnt == sg.setc - 1 || s == sg.sorted.length - 1) {
        //align left, val before id
          el.textContent = '' + val + ' ' + d.id;
      }
      else el.textContent = val; 
      var tw = el.getComputedTextLength();
      if (maxtw < tw) {
        maxtw = tw;
      }

      thisset.push({'id':d.id, 'set':d.set, 'val':d.val, 'x':x, 'y':y, 's':s, 'tw':tw, 'setcnt': setcnt, 'el': el});
 
 
      if (s == sg.sorted.length - 1 || sg.sorted[s+1].set != set) {
        //end of row, set header and do repass for text fitting & lines
        setcnt++;
        //todo accept setLabels as SG params
        at(g, 'width', maxtw);
        var sety = sg.offsetY > 0 ? sg.offsetY : sg.rowh;
        var setEl = newEl(g, 'text',    
                      'id','set'+set, 'y', sety, 
                      'font-family', sg.font,'font-size', sg.fontSize+2, 'fill', sg.fontColor);
        setEl.textContent = set;
        var htw = setEl.getComputedTextLength();
        var fnx = center;
        if (setcnt == 1) {
          fnx = right;
        }
        else if (s==sg.sorted.length-1) {
          fnx = left;
        }
        at(setEl, 'x', fnx(htw, maxtw, x));
        if (sg.sortVals == 'down') fitPriorRows(thisset,thisset.length-1, sg.rowh, oy, true); //todo this shouldn't be necessary, still needed for sort desc ...
        repassGraphSet.call(sg, thisset, lastset, maxtw, lastmax, sg.rowh, sg.gutterw, sg.strokew);
      }
    } // end for
  
    if (sg.resize) {
      resizeEl(sg);
    }
  }

  function fitPriorRows(thisset, startat, rowh, oy, checkAll) {
    while (startat > 0 && (checkAll || thisset[startat].y >= oy+rowh)
            && thisset[startat].y - thisset[startat-1].y < rowh) {
      thisset[startat-1].y = thisset[startat].y - rowh;
      startat--;
      at(thisset[startat].el, 'y', thisset[startat].y);
    }
  }

  function center(width, containerWidth, offset) {
    return offset + (containerWidth / 2 - width / 2);
  }
  function right(width, containerWidth, offset) {
    return offset + (containerWidth - width);
  }
  function left(width, containerWidth, offset) {
    return offset;
  }
  
  function centerText(el, containerWidth, offset) {
    var w = el.getComputedTextLength();
    return center(w, containerWidth, offset);
  }

  /***
    atts should be array (or json?) of strings of css attribute assignments
    (ie 'font-weight:bold')
  ***/
  function newEl(parent, type, atts) { 
    return newElNS("http://www.w3.org/2000/svg", parent, type, 
              Array.prototype.slice.call(arguments, 2));
  }
  
  function newElNS(ns, parent, type, atts) {
    if (isEmpty(type)) return;
    var el = document.createElementNS(ns,type);
    parent.appendChild(el);
    if (atts) 
      addAtts(el, Object.prototype.toString.call( atts ) === '[object Array]' ?
                  atts : Array.prototype.slice.call(arguments, 3));
    
    return el;
  }
  
  function addAtts(el, atts) {
    for (var a = 0; a+1 < atts.length; a+=2) {
      var val = atts[a+1];
      at(el, atts[a],atts[a+1]);
    }
    return el;
  }

  /***
      Firefox won't force container height to grow to accommodate new svg el height
      when declaring <!DOCTYPE html>
      so make sure you specify correctly or provide adequate space via other styling!
  ***/
  function resizeEl(sg) {
    var el = sg.el;
    var bb = sg.el.getBBox();
    var sx = bb.width + bb.x;
    var sy = bb.height + bb.y;
    
    //todo better parsing of style attribute px suffix for comparisons
    if(isNaN(el.style.height) || el.style.height <= sy) {
      el.style.height = (sy + 5) + "px";
    }
    if(isNaN(el.style.width) || el.style.width <= sx) {
      el.style.width = (sx + 5) + "px";
    }
    return 
  }
  
  function repassGraphSet(curr, last, maxtw, width, height, gutter, strokeWidth) {
    for(var c = 0; c < curr.length; c++) {
      fixTextWidth.call(this,curr[c]);
      if (last && last.length > 0) {
        for(var l = 0; l < last.length; l++) {
          if(curr[c].id == last[l].id) {
            
            var line = newEl(this.el, 'line', 'x1', last[l].x + width + gutter,
              'x2', curr[c].x - gutter, 'y1', last[l].y - height/4, 
              'y2', curr[c].y - height/4, 'stroke-width', strokeWidth, 'stroke-opacity',this.lineOpacity,
               'stroke', getLineColor(sg, curr[c].val - last[l].val));
          }
          else {
            //todo check for overlapping rows
            //currently being handled in its own separate little loop
          }
        }
      }
    }
    
    function fixTextWidth(d) {
      if (d.setcnt != this.setc - 1 && d.s != this.sorted.length - 1) at(d.el, 'x', right(d.tw, maxtw, d.x));
    }
    
    function getLineColor(sg, delta) {
      if (!isEmpty(sg.lineColorHi) && delta > sg.lineColorHiThreshold) {
        return sg.lineColorHi;
      }
      else if (!isEmpty(sg.lineColorLo) && delta < sg.lineColorLoThreshold) {
        return sg.lineColorLo;
      }
      else {
        return sg.lineColor;
      }
      
    }
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
  function docBox(parent, doc, svgWidth, offsetX, offsetY, y, rowHeight, font, fontSize, fontColor) {
    if (offsetX > 0) {
      var docw = offsetX - 10; //todo parameterize outer border or just use padding in style?
      var docel;
      var doclines = doc.split('\n');
      var docy = y + rowHeight;
      for (var i = 0; i < doclines.length; i++) {
        docel = newEl(parent,'text','x',10,'y', docy,'width',docw,'height',rowHeight,'font-family',font,'font-size',fontSize, 'fill', fontColor);
        docel.textContent = doclines[i];
        docy+=rowHeight;
      }
    }
     else if (offsetY > 0) {
      // todo draw above set headers when offsetY > 0
      // no faux text-wrapping here
      var doch = offsetY; // todo param outer pad
      var docel = newEl(parent,'text','x',10,'y', rowHeight,'height',doch,'font-family',font,'font-size',fontSize, 'fill', fontColor);
      docel.textContent = doc;
      at(docel,'x',centerText(docel,svgWidth,10));
    }
  }
}
  

  
  SG.clone = function(d) {
    var r = [];
    for (i in d) {
      r[i] = d[i];
    }
    return r;
  }

})();