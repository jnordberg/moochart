
/*
 * moochart
 *
 * @version     0.2
 * @license     MIT-style license
 * @author      Johan Nordberg <norddan@gmail.com>
 * @infos       http://moochart.coneri.se
 * @copyright   Author
 *
*/

var Chart = new Class({
  
  Implements: Options,
  
  options: {
    width: 600,
    height: 400,
    padding: {
      top: 20,
      left: 40,
      bottom: 30,
      right: 20
    },
    tipFollowsMouse: true,
    tipOffset: {
      x: 8,
      y: 18
    },
    id: null
  },
  
  initialize: function(options) {    
    this.setOptions(options);
    this.id = this.options.id || 'MooChart_' + $time();
    this._pos = null;
  },
  
  buildElement: function(){
    var canvas = document.createElement('canvas');
    canvas.id = this.id;
    canvas.width = this.options.width;
    canvas.height = this.options.height;
    canvas.style.display = 'block';
    
    // jumpstart excanvas if present
    if (typeof G_vmlCanvasManager != 'undefined') {
      G_vmlCanvasManager.initElement(canvas);
    }
    
    if (this.options.tipFollowsMouse)
      canvas.addEvent('mousemove', this.moveTip.bindWithEvent(this));
    
    canvas.addEvents({
      mouseenter: this.mouseEnter.bindWithEvent(this),
      mouseleave: this.mouseLeave.bindWithEvent(this)
    });
    
    var mouseListener = (Browser.Engine.trident) ? document : canvas;
    mouseListener.addEvent('mousemove', this.mouseMove.bindWithEvent(this));
    
    window.addEvent('resize', this.resetPosition.bindWithEvent(this));
    
    this.element = canvas;
    this.redraw();
  },
  
  toElement: function(){
    if (!this.element)
      this.buildElement();
    return this.element;
  },
  
  resetPosition: function(){
    this._pos = null;
  },
  
  getPosition: function(){
    if (!this._pos && this.element)
      this._pos = this.element.getPosition();
    return this._pos;
  },
  
  /* takes absolute page coords and translates it relative to canvas */
  translateCoords: function(coords){
    var pos = this.getPosition();
    return {
      x: coords.x - pos.x,
      y: coords.y - pos.y
    };
  },
  
  showTip: function(html, pos, className){
    /* implement simple tooltip overlay */
  },
  
  hideTip: function(){
    
  },
  
  moveTip: function(event){
    var pos = this.translateCoords(event.page);
    this.tip.setStyles({
      'left': pos.x+this.options.tipOffset.x,
      'top': pos.y+this.options.tipOffset.y
    });
  },
  
  /* subclasses needs to implement this */
  mouseMove: function(event){},
  mouseEnter: function(event){},
  mouseLeave: function(event){},
  redraw: function(){}
  
});

Chart.Line = new Class({
  
  Extends: Chart,
  
  options: {
    pointZoom: 1.2,
    xlabel: {
      steps: 10,
      size: 10
    },
    ylabel: {
      steps: 10,
      size: 10
    },
    lineDefaults: {
      color: '#000000',
      lineWidth: 6,
      toolTip: 'x:%x y:%y',
      tipClass: null
    }
  },
  
  xmax: null,
  ymax: null,
  xmin: Infinity,
  ymin: Infinity,
  
  initialize: function(options) {
    this.parent(options);
    this.sets = [];
    this._points = [];
    this._active = {set: null, point: null};
    this._drawRect = null;
    this.needsLabelsUpdate = false;
    this.updateDrawRect();
  },
  
  add: function(data, options){
    if (!options) var options = {};
    var defaults = {};
    for (var k in this.options.lineDefaults) {
      defaults[k] = this.options.lineDefaults[k];
    }
    this.sets.unshift({
      options: $extend(defaults, options),
      data: data
    });
    this.updatePoints();
    this.needsLabelsUpdate = true;
  },
  
  buildElement: function(){
    this.needsLabelsUpdate = true;
    this.parent();
  },
  
  /* calculate drawable area */
  updateDrawRect: function(){
    var w = this.options.width, h = this.options.height;
    var p = this.options.padding;
    this._drawRect = {
      x: p.left,
      y: p.top,
      width: w - (p.left + p.right),
      height: h - (p.top + p.bottom)
    };
  },
  
  /* get min and max values for all sets */
  getSetsRange: function(){
    var xmax = this.xmax, ymax = this.ymax
    var xmin = this.xmin, ymin = this.ymin;
    this.sets.each(function(set){
      for (var i=0; i < set.data.length; i++) {
        var x = set.data[i][0], y = set.data[i][1];
        if (x > xmax) xmax = x;
        if (y > ymax) ymax = y;
        if (x < xmin) xmin = x;
        if (y < ymin) ymin = y;
      }
    });
    return {
      x: {max: xmax, min: xmin},
      y: {max: ymax, min: ymin}
    };
  },
  
  /* map data set x,y data to pixel coordinates */
  updatePoints: function(){
    var points = [];
    var range = this.getSetsRange();
    
    var maxLineWidth = 0;
    for (var set_idx=0; set_idx < this.sets.length; set_idx++) {
      var lineWidth = this.sets[set_idx].options.lineWidth;
      if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
    }
    maxLineWidth *= this.options.pointZoom;
    maxLineWidth += 5;
    
    var rx = this._drawRect.x + maxLineWidth;    
    var ry = this._drawRect.y + maxLineWidth;
    var rw = this._drawRect.width - maxLineWidth * 2;
    var rh = this._drawRect.height - maxLineWidth * 2;
    
    var xunit = rw / (range.x.max - range.x.min);
    var yunit = rh / (range.y.max - range.y.min);
    
    for (var set_idx=0; set_idx < this.sets.length; set_idx++) {
      var set = this.sets[set_idx];
      points[set_idx] = [];
      for (var data_idx=0; data_idx < set.data.length; data_idx++) {
        var xval = set.data[data_idx][0], yval = set.data[data_idx][1]; 
        var x = rx + ((xval - range.x.min) * xunit);
        var y = ry + (rh - (yval - range.y.min) * yunit);
        points[set_idx][data_idx] = [x, y];
      }
    }
    
    this._points = points;
    this._xunit = xunit;
    this._yunit = yunit;
    this._xsteps = range.x.max - range.x.min;
    this._ysteps = range.y.max - range.y.min;
    this._maxLw = maxLineWidth;
    this._range = range;
  },
  
  updateLabels: function() {
    var ctx = this.canvas.getContext('2d');
    var rect = this._drawRect;
    
    var w = this.options.width, h = this.options.height;
    var p = this.options.padding, lw = 1;
    
    ctx.clearRect(0, 0, rect.x, rect.y+rect.height);
    ctx.clearRect(0, rect.y+rect.height, w, p.bottom);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(p.left-lw, p.top-lw);
    ctx.lineTo(p.left-lw, h - p.bottom + lw);
    ctx.lineTo(w - p.right, h - p.bottom + lw);
    ctx.stroke();
    
    var xb = this._maxLw + rect.x;
    var xu = this._xunit * this._xsteps / (this.options.xlabel.steps - 1);
    
    ctx.font = '8pt Helvetica';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    
    for (var i=1; i < this.options.xlabel.steps+1; i++) {
      var x = xb+xu*(i-1), y = rect.height+rect.y;
      var val = (xu*(i-1)) / this._xunit + this._range.x.min;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
      
      var text = this.formatXValue(val);
      ctx.fillText(text, x, y + 14);
    }
    
    var yb = p.bottom + this._maxLw;
    var yu = this._yunit * this._ysteps / (this.options.ylabel.steps - 1);
    
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    
    for (var i=1; i < this.options.ylabel.steps+1; i++) {
      var x = rect.x, y = h-(yb+yu*(i-1));
      var val = (yu*(i-1)) / this._yunit + this._range.y.min;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 10, y);
      ctx.stroke();
      
      var text = this.formatYValue(val);
      ctx.fillText(text, x - 14, y);
    }
    this.needsLabelsUpdate = false;
  },
  
  formatXValue: function(val){
    return Math.round(val);
  },
  
  formatYValue: function(val){
    return Math.round(val);
  },
  
  createXLabel: function(x, y, val){
    var w = this._drawRect.width/this.options.xlabel.steps;
    return new Element('label', {
      'text': this.formatXValue(val),
      'class': 'x-axis',
      'styles': {
        'display': 'block',
        'position': 'absolute',
        'text-align': 'center',
        'width': w,
        'left': x-(w/2),
        'top': y+3
      }
    });
  },
  
  createYLabel: function(x, y, val){
    var w = this.options.padding.left-10;
    var h = this._drawRect.height/this.options.ylabel.steps;
    return new Element('label', {
      'text': this.formatYValue(val),
      'class': 'y-axis',
      'styles': {
        'display': 'block',
        'position': 'absolute',
        'text-align': 'right',
        'line-height': h,
        'width': w-3,
        'height': h,
        'left': x-w,
        'top': y-(h/2)
      }
    });
  },
  
  redraw: function(){
    var padding = this.options.padding;
    var ctx = this.canvas.getContext('2d');
    
    // redraw everything if using excanvas
    if (typeof G_vmlCanvasManager != 'undefined') this.needsLabelsUpdate = true;
    
    ctx.clearRect(
      this.options.padding.left,
      this.options.padding.top,
      this.options.width,
      this.options.height - padding.bottom - padding.top
    );
    
    if (this.needsLabelsUpdate) this.updateLabels();
    
    ctx.lineJoin = 'bevel';
    
    for (var idx = this._points.length - 1; idx >= 0; idx--){
      var set = this.sets[idx];
      var points = this._points[idx];
      var lineWidth = set.options.lineWidth;
      var color = set.options.color;
      
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = set.options.lineWidth;
      
      // draw lines
      ctx.beginPath();
      for (var i=0; i < points.length; i++) {
        var x = points[i][0], y = points[i][1];
        if (i == 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      };
      ctx.stroke();
      
      var hasActive = (this._active.set == idx);
      
      // draw dots
      for (var i=0; i < points.length; i++) {
        if (hasActive && this._active.point == i)
          continue; // render this later
        ctx.beginPath();
        ctx.arc(points[i][0], points[i][1], lineWidth, 0, Math.PI * 2, true);
        ctx.fill();
      };
      
    };
    
    if (this._active.set != null) {
      // render active point
      var p = this._points[this._active.set][this._active.point];
      var o = this.sets[this._active.set].options;
      var lw = o.lineWidth * this.options.pointZoom;
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(p[0], p[1], lw, 0, Math.PI * 2, true);
      ctx.fill();
    }
    
  },
  
  mouseMove: function(event){
    var c = this.translateCoords(event.page);
    var active = null;
    
    for (var i=0; i < this._points.length; i++) {
      var p = this._points[i];
      var lw = this.sets[i].options.lineWidth;
      for (var j = p.length - 1; j >= 0; j--){
        var cx = c.x - p[j][0], cy = c.y - p[j][1], cz = lw + 1;
        if ((cx * cx) + (cy * cy) <= (cz * cz)) {
          active = {set: i, point: j};
          break;
        }
      }
      if (active) break;
    };
    
    if (active) {
      if (active.set != this._active.set || active.point != this._active.point) {
        this._active = active;
        this.redraw();
        var set = this.sets[active.set];
        if (set.options.toolTip) {
          var p = set.data[active.point], tipClass;
          if (!this.options.tipFollowsMouse) {
            var dp = this._points[active.set][active.point];
            c = {x: dp[0], y: dp[1]};
          }
          var t = set.options.toolTip
            .replace('%x', this.formatXValue(p[0]))
            .replace('%y', this.formatYValue(p[1]));
          this.showTip(t, c, set.options.tipClass); 
        }
      }
    } else if (this._active.set != null || this._active.point != null) {
      this._active = {set: null, point: null};
      this.redraw();
      this.hideTip();
    }
  }
  
});

Chart.DateLine = new Class({
  
  Extends: Chart.Line,
  
  formatXValue: function(val){
    var date = new Date(), r = [];
    var yearNow = date.getFullYear();
    date.setTime(val * 1000);
    if (yearNow != date.getFullYear()) {
      r.push(date.getFullYear());
    }
    r.push(date.getMonth()+1);
    r.push(date.getDate());
    r = r.map(function(v){
      v = String(v);
      return (v.length == 1) ? '0' + v : v;
    });
    return r.join('-');
  }
  
});

/*
Chart.Bubble = new Class({
  
  Extends: Chart,
  
  options: {
    width: 600,
    height: 400,
    xmin: 0, xmax: 100,
    ymin: 0, ymax: 100,
    zmin: 0, zmax: 1,
    xsteps: 5,
    ysteps: 5,
    xlabel: null,
    ylabel: null,
    bubbleSize: 30,
    lineColor: '#000'
  },
  
  initialize: function(container, options) {
    
    this.setOptions(options);
    
    this.options.xsteps--;
    this.options.xsteps = this.options.xsteps.limit(1,50),
    
    this.options.ysteps--;
    this.options.ysteps = this.options.ysteps.limit(1,50),
    
    this.container = $(container);
    
    this.container.setStyles({
      'width': this.options.width,
      'height': this.options.height,
    });
    
    this.canvas = new Element('canvas');
    this.canvas.adopt(new Element('div', {
      'text': 'Your browser does not support the canvas element, get a better one!',
      'styles': {
        'text-align': 'center',
        'background-color': '#8b2e19',
        'width': this.options.width,
        'height': this.options.height,
        'color': '#fff'
      }
    }));
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.container.adopt(this.canvas);
    
    if (!this.canvas.getContext) return false;
    
    this.overlay = new Element('div', {
      styles: {
        'position': 'relative',
        'width': this.options.width,
        'height': this.options.height,
        'top': 0-this.options.height-3,
        'margin-bottom': 0-this.options.height-3,
        'font-family': 'Helvetica, Arial, sans-serif',
        'z-index': 240
      }
    });
    this.overlay.addEvent('mousemove', this.mouseHandler.bind(this));
    this.overlay.addEvent('mouseout', function() {
      this.tip.style.display = 'none';
      this.activeBubble = -1;
      this.redraw();
    }.bind(this));
    this.container.adopt(this.overlay);
    
    this.tip = new Element('div', {
      text: '',
      styles: {
        'position': 'absolute',
        'display': 'none',
        'border': '2px solid #000',
        'background-color': '#262626',
        'padding': '0.5em',
        '-webkit-border-radius': '3px',
        '-moz-border-radius': '3px',
        'white-space': 'nowrap',
        'z-index': 250,
        'color': '#fff',
        'font-size': '11px',
        'line-height': '1.3em',
        'text-align': 'left'
      }
    });
    this.overlay.adopt(this.tip);
    
    this.ctx = this.canvas.getContext('2d');
    
    this.bubbles = new Array;
    this.activeBubble = -1;
    
    this.paddingTop = 30;
    this.paddingLeft = 40;
    this.paddingBottom = 30;
    this.paddingRight = 40;
    
    if (this.options.ylabel) this.paddingLeft+=30;
    if (this.options.xlabel) this.paddingBottom+=20;
    
    this.xwork = (this.options.width - (this.paddingLeft + this.paddingRight)) - this.options.bubbleSize * 2;
    this.ywork = (this.options.height - (this.paddingTop + this.paddingBottom)) - this.options.bubbleSize * 2;
    
    this.xmax = this.options.xmax;
    this.xmin = this.options.xmin;
    
    this.ymax = this.options.ymax;
    this.ymin = this.options.ymin;
    
    this.zmax = this.options.zmax;
    this.zmin = this.options.zmin;
    
    this.xnumbers = new Array;
    this.ynumbers = new Array;
    
    var xstep = this.xwork / this.options.xsteps;
    var ystep = this.ywork / this.options.ysteps;
    
    (this.options.xsteps + 1).times(function(i) {
      this.xnumbers.push(new Element('div', {
        text: '',
        styles: {
          'position': 'absolute',
          'font-size': '10px',
          'line-height': '20px',
          'height': '20px',
          'width': xstep + 'px',
          'text-align': 'center',
          'top': (this.options.height - this.paddingBottom + 10) + 'px',
          'left': (this.paddingLeft + this.options.bubbleSize) - (xstep / 2) + i * xstep + 'px',
          'color': this.options.lineColor
        }
      }));
    }.bind(this));
 
    (this.options.ysteps + 1).times(function(i) {
      this.ynumbers.push(new Element('div', {
        text: '',
        styles: {
          'position': 'absolute',
          'font-size': '10px',
          'line-height': '20px',
          'height': '20px',
          'vertical-align': 'middle',
          'width': (this.paddingLeft - 15) + 'px',
          'text-align': 'right',
          'top': (this.options.bubbleSize + (i * ystep) + this.paddingTop - 10) + 'px',
          'left': '0px',
          'color': this.options.lineColor
        }
      }));
    }.bind(this));
 
    this.overlay.adopt(this.xnumbers);
    this.overlay.adopt(this.ynumbers);
    
    var labelStyles = {
      'position': 'absolute',
      'font-size': '10px',
      'line-height': '20px',
      'width': (this.xwork) + 'px',
      'text-align': 'center',
      'bottom': '0px',
      'letter-spacing': '0.1em',
      'left': (this.paddingLeft + this.options.bubbleSize ) + 'px',
      'color': this.options.lineColor
    }
    
    if (this.options.xlabel) {
      
      this.xlabel = new Element('div', {
        text: this.options.xlabel,
        styles: labelStyles
      });
      
      this.overlay.adopt(this.xlabel, this.ylabel);
      
    }
    
    if (this.options.ylabel) {
      
      var ylabelText = '';
      var yl = this.options.ylabel;
      
      for(var i = 0; i < yl.length; i++) {
        ylabelText += "<br />" + yl.charAt(i);
      }
      
      this.ylabel = new Element('div', {
        html: ylabelText,
        styles: labelStyles
      });
      
      this.ylabel.setStyles({
        'width': '20px',
        'height': 1.1 * (i+2) + 'em',
        'left': '0px',
        'top': '0px',
        'line-height': '1.1em'
      });
      
      this.overlay.adopt(this.ylabel);
    
      var ylh = this.ylabel.getSize().y;
      this.ylabel.setStyle('top', (this.paddingTop + this.options.bubbleSize) + ((this.ywork - ylh) / 2));
    
    }
    
    this.drawLabels();
    this.updateNumbers();
    this.redraw();
  },
  
  drawLabels: function() {
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = this.options.lineColor;
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddingLeft, this.paddingTop);
    this.ctx.lineTo(this.paddingLeft, this.options.height - this.paddingBottom);
    this.ctx.lineTo(this.options.width - this.paddingRight, this.options.height - this.paddingBottom);
      this.ctx.stroke();
    
    var xstep = this.xwork / this.options.xsteps;
    var ystep = this.ywork / this.options.ysteps;
    
      this.ctx.beginPath();
    this.ctx.lineWidth = 2;
    
    (this.options.xsteps + 1).times(function(i) {
      var mov = this.paddingLeft + this.options.bubbleSize + xstep * i;
        this.ctx.moveTo(mov, this.options.height - this.paddingBottom);
      this.ctx.lineTo(mov, this.options.height - this.paddingBottom + 10);
    }.bind(this));
 
    (this.options.ysteps + 1).times(function(i) {
      var mov = this.options.height - (this.paddingBottom + this.options.bubbleSize + ystep * i);
        this.ctx.moveTo(this.paddingLeft, mov);
      this.ctx.lineTo(this.paddingLeft - 10, mov);
    }.bind(this));
    
      this.ctx.stroke();
  
  },
  
  // color can be #fff, rgb(123,13,2) or array - [121,312,34]
  addBubble: function(x, y, z, color, tip) {
    
    if ($type(color) == 'array') color = 'rgb('+color.join(',')+')';
    
    x = parseInt(x);
    y = parseInt(y);
    z = parseInt(z);
    
    tip = tip.replace(/%x/ig, x);
    tip = tip.replace(/%y/ig, y);
    tip = tip.replace(/%z/ig, z);
    
    this.bubbles.push({
      x: x,
      y: y,
      z: z,
      color: color,
      tip: tip
    });
        
    if (z > this.zmax) this.zmax = z;
    if (z < this.zmin) this.zmin = z;
    
    if (x > this.xmax) this.xmax = x;
    if (x < this.xmin) this.xmin = x;
    
    if (y > this.ymax) this.ymax = y;
    if (y < this.ymin) this.ymin = y;
    
    this.updateNumbers();
    
    // Big goes to the back!
    this.bubbles.sort(function(a, b) { return b.z - a.z; });
  },
  
  updateNumbers: function() {
    
    var xstep = (this.xmax - this.xmin) / this.options.xsteps;
    this.xnumbers.each(function(el, i) { el.set('text', (xstep * i + this.xmin).round()); }.bind(this));
    
    var ystep = (this.ymax - this.ymin) / this.options.ysteps;
    this.ynumbers.each(function(el, i) { el.set('text', (this.ymax + this.ymin) - ((ystep*i) + this.ymin).round()); }.bind(this));
  
  },
  
  mouseHandler: function(e) {
    
    var pos = this.canvas.getCoordinates();
    var x = e.page.x - pos.left, y = e.page.y - pos.top;
    var active = -1, l = this.bubbles.length;
    
   // this.ctx.fillStyle = '#000';
   // this.ctx.beginPath();
   // this.ctx.arc(x, y, 2, 0, Math.PI * 2, true);
   // this.ctx.fill();
    
    for (var i = l - 1; i >= 0; i--) {
      var cx = x - this.bubbles[i].realx, cy = y - this.bubbles[i].realy, cz = this.bubbles[i].realz + 1;
      if ((cx * cx) + (cy * cy) <= (cz * cz)) {
        active = i;
        break;
      }
    }
    
    if (this.activeBubble != active) {
      this.activeBubble = active;
      this.redraw();
      if (this.activeBubble >= 0) {
        this.tip.set('html', this.bubbles[this.activeBubble].tip);
        this.tip.setStyle('display', 'block');
      } else {
        this.tip.setStyle('display', 'none');
      }
    }
    
    if (this.activeBubble >= 0) {
      this.tip.setStyle('left', x + 10);
      this.tip.setStyle('top', y + 15);
    }
    
    
  },
  
  redraw: function() {
    var l = this.bubbles.length;
    this.ctx.clearRect(this.paddingLeft + 2, 0, this.options.width, this.options.height - (this.paddingBottom + 2));
    this.ctx.lineWidth = 1;
    for(var i = 0; i < l; i++) {
      var x = (((this.bubbles[i].x - this.xmin) / (this.xmax - this.xmin)) * this.xwork).round() + this.paddingLeft + this.options.bubbleSize;
      var y = (this.ywork - (((this.bubbles[i].y - this.ymin) / (this.ymax - this.ymin)) * this.ywork).round()) + this.paddingTop + this.options.bubbleSize;
      var z = (((this.bubbles[i].z - this.zmin) / (this.zmax - this.zmin)) * (this.options.bubbleSize - 8)).round() + 5;
 
      this.ctx.beginPath();
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = this.bubbles[i].color;
      this.ctx.strokeStyle = this.bubbles[i].color;
      this.ctx.arc(x, y, z, 0, Math.PI * 2, true);
      this.ctx.stroke();
      if (this.activeBubble != i) this.ctx.globalAlpha = 0.6;
      this.ctx.fill();
      
      this.bubbles[i].realx = x; this.bubbles[i].realy = y; this.bubbles[i].realz = z;
    }
  },
  
  clear: function() {
      this.ctx.clearRect(0, 0, this.options.width, this.options.width);
    this.drawLabels();
  },
  
  empty: function() {
    this.xmax = this.options.xmax;
    this.xmin = this.options.xmin;
    this.ymax = this.options.ymax;
    this.ymin = this.options.ymin;
    this.zmax = this.options.zmax;
    this.zmin = this.options.zmin;
    this.addBubble(this.xmax, this.ymax, this.zmax, [0, 0, 0], '');
    delete this.bubbles;
    this.bubbles = new Array;
    this.redraw();
  }
});
*/




