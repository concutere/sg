SG - a library for creating slopegraphs

==

sg.js creates SVG content, is dependency-free and should work in modern browsers with SVG support. 

To use, call SG(jsonData, svgElement, settings). Data is expected as a json array with 'id', 'set' & 'val' attributes. Settings are optional but you most likely will want to set at least textWidth, slopeWidth & height. See sg.html for samples.

So far the fitting logic is fairly simple, more options and improvements here are the current focus.

Happy graphing!

and of course, thank you [Edward Tufte](http://www.edwardtufte.com/bboard/q-and-a-fetch-msg?msg_id=0003nk)