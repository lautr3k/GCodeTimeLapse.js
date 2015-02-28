// parse
function parseLines(lines, onLine) {
    // line num
    var num = 0;

    // for each line
    while(lines.length) {
        // increment line num
        num++

        // line params
        var params = {};

        // current trimmed line
        var line = lines.shift().trim();

        // skip empty line or comment
        if (!line || line.charAt(0) == ';') {
            // callback
            if (onLine(num, line, params) === false) break;
            continue;
        }

        // split line on comment
        var line_parts = line.split(';');

        // split first line part on witespace
        line_parts = line_parts[0].trim().split(/\s/);
        
        // for each part
        while(line_parts.length) {
            // current trimmed param
            var param = line_parts.shift().trim();

            // skip comment
            if (param.charAt(0) == ';') break;

            // split param
            var param_parts = param.split(/\s/);

            // value
            var value = param.substring(1);

            // is a number ?
            if (parseInt(value) == value) {
                value = parseInt(value);
            }
            else if (parseFloat(value) == value) {
                value = parseFloat(value);
            }

            // add to params object
            params[param.charAt(0)] = value;
        }

        // callback
        if (onLine(num, line, params) === false) break;
    }
}

// ----------------------------------------------------------------------------

// parse
function parseInfo(lines) {
    // info
    var info = {
        linesCount      : lines.length,
        layersCount     : 0,
        layerHeight     : null,
        firstLayerHeight: null,
        vaseMode        : false
    }

    // last position
    var lastPosition = {X: 0, Y: 0, Z: 0};

    // first move in layer
    var firstMove = false;

    // parsed lines
    var parsedLines = [];

    // end of print
    var end = false;

    // layer min/max position
    var layersPosition = [];
    var layerPosition  = null;

    // parse
    parseLines(lines, function(num, line, params) {
        // action
        var action = 'newLine';

        // first pass
        postMessage({
            action: 'firstPass',
            data  : {num: num, info: info}
        });

        // has gcode
        if (params.G != undefined) {
            // current position
            var currentPosition = {
                X: params.X == undefined ? lastPosition.X : params.X,
                Y: params.Y == undefined ? lastPosition.Y : params.Y,
                Z: params.Z == undefined ? lastPosition.Z : params.Z
            };

            // try to find the first layer
            if (!info.firstLayerHeight) {
                // if the layer is in [0 - 1] mm rang
                if (currentPosition.Z > 0 && currentPosition.Z < 1) {
                    // first layer height
                    info.firstLayerHeight = currentPosition.Z;
                    
                    // callback event
                    action = 'firstLayer';
                }
            }
            else {
                // try to detect layer change
                if (currentPosition.Z > lastPosition.Z) {
                    // try to detect vase mode
                    if (!info.vaseMode && (currentPosition.Z - lastPosition.Z) < 0.05) {
                        info.vaseMode = true;
                    }

                    // not in vase mode
                    if (!info.vaseMode || (info.vaseMode && ((currentPosition.Z*10) % (info.layerHeight*10)) == 0)) {
                        // layer height
                        if (!info.layerHeight) {
                            info.layerHeight = currentPosition.Z - lastPosition.Z;
                            info.layerHeight = Math.round(info.layerHeight * 100) / 100;
                        }

                        // callback event
                        action = 'newLayer';
                    }
                }

                // try to detect first move in layer
                if (!firstMove && action != 'newLayer') {
                    // move in X or Y drection
                    if (currentPosition.X != lastPosition.X || currentPosition.Y != lastPosition.Y) {
                        action    = 'firstMove';
                        firstMove = true;
                    }
                }
            }

            // update min/max value
            if (layerPosition) {
                layerPosition = {
                    X: {
                        min: Math.min(layerPosition.X.min, currentPosition.X),
                        max: Math.max(layerPosition.X.max, currentPosition.X)
                    },
                    Y: {
                        min: Math.min(layerPosition.Y.min, currentPosition.Y),
                        max: Math.max(layerPosition.Y.max, currentPosition.Y)
                    }
                };
            }

            // new layer
            if (action == 'newLayer' || action == 'firstLayer') {
                
                // push layer position
                if (info.layersCount && layerPosition) {
                    //console.log(info.layersCount, layerPosition)
                    layersPosition.push(layerPosition);
                }
                
                // reset position
                layerPosition = {
                    X : {min: 10000, max: 0},
                    Y : {min: 10000, max: 0}
                };

                // reset
                firstMove     = false;
                //layerPosition = null;

                // increment layer counter
                info.layersCount++;

                // normalize action
                action = 'layerChange';
            }

            // backup last position
            lastPosition = currentPosition;
        }

        // print end (dirty way!!!)
        if (!end && info.layersCount > 1 
        && (params.G == 28 || params.M == 104 
        || params.M == 107 || params.M == 140 || params.M == 84)) {
            info.layersCount--;
            action = 'printEnd';
            end    = true;
        }

        // callback event
        parsedLines.push({
            action: action, 
            data: {
                num  : num, 
                line : line, 
                info : info,
                pos  : currentPosition,
                layer: info.layersCount
            }
        });

        // debug...
        //if (num > 3000) return false;
    });

    // push layer position
    layerPosition && layersPosition.push(layerPosition);

    // add parsed line
    parsedLines.push({action: 'end', data: {info: info}});

    return {parsedLines: parsedLines, layersPosition: layersPosition};
}


// ----------------------------------------------------------------------------

// parse positions
function parseAll(data, callback) {
    // parsed lines and position
    var info   = parseInfo(data);
    var lines  = info.parsedLines;
    var layers = info.layersPosition;

    // status
    var status = {};

    // for each lines
    while(lines.length) {
        // current parsed line
        var line = lines.shift();

        // reset status
        if (line.action == 'layerChange') {
            status = {};
        }

        // if not the end
        else if (line.action != 'end' && line.data.pos && line.data.layer > 0) {
            // layer positions
            var layer = layers[line.data.layer-1];

            // min/max events
            if (!status.minX && layer.X.min == line.data.pos.X) {
                line.action = 'minX';
                status.minX = true;
            }
            if (!status.maxX && layer.X.max == line.data.pos.X) {
                line.action = 'maxX';
                status.maxX = true;
            }
            if (!status.minY && layer.Y.min == line.data.pos.Y) {
                line.action = 'minY';
                status.minY = true;
            }
            if (!status.maxY && layer.Y.max == line.data.pos.Y) {
                line.action = 'maxY';
                status.maxY = true;
            }
        }

        callback(line.action, line.data);
    }
}


// ----------------------------------------------------------------------------

// parse
function parse(data) {
    // parse
    parseAll(data.lines, function(action, data) {
        postMessage({
            action: action,
            data  : data
        });
    });
}

// ----------------------------------------------------------------------------

// worker
onmessage = function(e) {
    if (e.data.cmd == 'parse') parse(e.data);
};
