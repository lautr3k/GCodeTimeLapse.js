/*
The MIT License (MIT)

Copyright (c) 2014 Sébastien Mischler (skarab)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function (window) {

    /** GCodeTimeLapse constructor */
    function GCodeTimeLapse(mcode, gcode) {
        // new parser
        this.reset();

        // properties
        this.inputGCode  = '';
        this.outputGCode = '';

        // after/before actions
        this.before = {
            layerChange: true,
            firstMove  : false,
            printEnd   : true,
            minX       : false,
            maxX       : false,
            minY       : false,
            maxY       : false
        };

        this.after = {
            layerChange: false,
            firstMove  : false,
            printEnd   : false,
            minX       : false,
            maxX       : false,
            minY       : false,
            maxY       : false
        };

        // shots count
        this.shotsCount = 0;
        
        // trigger code
        this.mcode = mcode || 'M108';
        
        // load gcode
        gcode && this.parse(gcode);
    }

    // ------------------------------------------------------------------------

    /** on first pass */
    GCodeTimeLapse.prototype.onFirstPass = function(data) {};
    
    /** on get line */
    GCodeTimeLapse.prototype.onGetLine = function(data) {};
    
    /** on parsing end */
    GCodeTimeLapse.prototype.onEnd  = function(data) {};
    
    // ------------------------------------------------------------------------

    // on first pass
    GCodeTimeLapse.prototype._onFirstPass = function(data) {
        // public callback
        this.onFirstPass(data.data);
    };
    
    // ------------------------------------------------------------------------

    GCodeTimeLapse.prototype._addAction = function(where, action) {
        // append M code to output
        this.outputGCode += this.mcode+'; action '+where+' '+action+'\n';
        // increment counter
        this.shotsCount++;
    }

    // on get line
    GCodeTimeLapse.prototype._onGetLine = function(data) {
        // add custom M code line
        if (this.before[data.action]) {
            this._addAction('before', data.action);
        }

        // add the line to output
        this.outputGCode += data.data.line + '\n';

        // add custom M code line
        if (this.after[data.action]) {
            this._addAction('after', data.action);
        }

        // public callback
        this.onGetLine(data.data);
    };
    
    // ------------------------------------------------------------------------

    // on parsing end
    GCodeTimeLapse.prototype._onEnd = function(data) {
        // public callback
        this.onEnd(data.data);
    };
    
    // ------------------------------------------------------------------------

    /** reset the current worker */
    GCodeTimeLapse.prototype.reset = function() {
        // terminate if exists
        this.parser && this.parser.terminate();
        
        // new instance
        this.parser = new Worker('js/gcodetimelapse/parser.js');
        
        // self alias
        var self = this;

        // on parser message
        this.parser.onmessage = function(e) {
            if      (e.data.action == 'end')       self._onEnd(e.data);
            else if (e.data.action == 'firstPass') self._onFirstPass(e.data);
            else                                   self._onGetLine(e.data);
        }
    };

    // ------------------------------------------------------------------------

    /** start parsing */
    GCodeTimeLapse.prototype.parse = function(gcode) {
        // reset input/output gcode
        this.inputGCode  = gcode;
        this.outputGCode = '';
        this.shotsCount  = 0;

        // start parsing
        this.parser.postMessage({
            cmd  : 'parse',
            lines: gcode.split(/\n/g)
        });
    };

    // ------------------------------------------------------------------------

    // export
    window.GCodeTimeLapse = GCodeTimeLapse;

})(this);