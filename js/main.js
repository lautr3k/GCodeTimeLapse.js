// main object instance
var gctl = new GCodeTimeLapse();

// I/O file name
var input_filename   = 'cube.gcode';
var output_filename  = 'cube.GCTL.gcode';

// freez all
$('.freez').prop('disabled', true);
$('#saveFileButton').prop('disabled', true);

// set files name
$('#inputFileName').html(input_filename);
$('#outputFileName').html(output_filename);

// load demo file contents
$.ajax({
    xhr: function()
    {
        var xhr = new window.XMLHttpRequest();
        
        xhr.addEventListener("progress", function(e) {
            if (e.lengthComputable) 
                loadGCodeProgress('loading', e.loaded, e.total);
        }, false);

        return xhr;
    },
    type   : 'GET',
    url    : './gcode/' + input_filename,
    data   : {},
    success: loadGCode
});


// ----------------------------------------------------------------------------

// check for local file access
if (window.File && window.FileReader && window.FileList && window.Blob) {
    jQuery.event.props.push("dataTransfer");
    $('.__file_support').show();
    $('#inputFile').hide();
}

// check for file saver support
try {
    !!new Blob;
    $('.__file_saver_support').show();
} catch (e) {}

// ----------------------------------------------------------------------------

// update input filename
function updateInputFileName() {
    input_filename  = $('#inputFileName').html();

    var file_ext    = input_filename.split('.').pop();
    output_filename = input_filename.replace(file_ext, 'GCTL.'+file_ext);

    $('#outputFileName').html(output_filename);
}

// update output filename
function updateOutputFileName() {
    output_filename = $('#outputFileName').html();
}

// input file handler
function onInputFileChange(e) {
    e.stopPropagation();
    e.preventDefault();

    var source = e.dataTransfer || e.target;
    var file   = source.files[0];
    
    if (! file) return;
    
    $('.freez').prop('disabled', true);
    
    var reader = new FileReader();

    input_filename  = file.name;
    var file_ext    = input_filename.split('.').pop();
    output_filename = input_filename.replace(file_ext, 'GCTL.'+file_ext);

    $('#inputFileName').html(input_filename);
    $('#outputFileName').html(output_filename);
    
    reader.onprogress = function(e) {
        if (e.lengthComputable) 
            loadGCodeProgress('loading', e.loaded, e.total);
    };

    reader.onload = function(e) {
        loadGCode(e.target.result);
    };

    reader.readAsText(file);
}

function onDragFileOver(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

// ----------------------------------------------------------------------------

function openFile(e) {
    $('#inputFile').click()
}

// save file as
function saveFile() {
    var gcode = $('#output').val();
    if(!gcode) return;
    saveAs(new Blob(
        [gcode], 
        {type: "text/plain;charset=utf-8"}
    ), output_filename);
}

// ----------------------------------------------------------------------------

// return the current date
function date() {
    var d = new Date();
    function p(i) { return i > 9 ? i : '0' + i; }
    return d.getFullYear()+'-'+p(d.getMonth() + 1)+'-'+p(d.getDate());
}

// return the current time
function time() {
    var d = new Date();
    function p(i) { return i > 9 ? i : '0' + i; }
    return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}

// ----------------------------------------------------------------------------

// last line time
var lastUpdateTime = Date.now();

// on new line
gctl.onFirstPass = function(data) {
    // trottle
    var updateTime = Date.now();
    if (updateTime - lastUpdateTime < 10) {
    	return;
    }
    lastUpdateTime = updateTime;

    // loading message
    loadGCodeProgress('parsing: pass: 1/2', data.num, data.info.linesCount);
}

// on new line
gctl.onGetLine = function(data) {
    // trottle
    var updateTime = Date.now();
    if (updateTime - lastUpdateTime < 10) {
        return;
    }
    lastUpdateTime = updateTime;
    
    // loading message
    loadGCodeProgress('parsing: pass: 2/2', data.num, data.info.linesCount);
}

// on ended
gctl.onEnd = function(data) {
    // info
    $.each(data.info, function(key, val) {
        $('#'+key).html(''+val);
    });
    $('#shotsCount').html(this.shotsCount);
    $('.dynamic').show();
    
    // output header
    var c = '; enhanced by GCodeTimeLapse.js on '+date()+' at '+time()+'\n';

    // shot count
    c += '; shotsCount = '+ this.shotsCount;

    $.each(this.before, function(key, val) {
        if (val) c += ', before_'+key;
        if (gctl.after[key]) c += ', after_'+key;
    });

    c += '\n\n';

    // add gcode
    $('#input').val(this.inputGCode);
    $('#output').val(c + this.outputGCode);

    // reset button
    $('#parseButton').show();
    $('#abortButton').hide();
    $('.freez').prop('disabled', false);
    $('#saveFileButton').prop('disabled', false);
}

// ----------------------------------------------------------------------------

// on loading progress
function loadGCodeProgress(message, loaded, total) {
    var percent = Math.round(loaded * 100 / total);
    $('#input').val(message+' : '+percent+' %').show();
    $('#output').val('');
}

// load gcode
function loadGCode(gcode) {
    $('.dynamic').hide();
    $('#input').val(gcode);
    $('.freez').prop('disabled', false);
    $('#loading').html('loaded : ' + input_filename);
}

// parse loaded gcode
function parse() {
    $('.dynamic').hide();
    $('#parseButton').hide();
    $('#abortButton').show();
    $('.freez').prop('disabled', true);
    $('#saveFileButton').prop('disabled', true);
    gctl.parse($('#input').val());
}

// abort parsing
function abort() {
    gctl.reset();
    
    // add gcode
    $('#input').val(gctl.inputGCode);
    $('#output').val('aborted...');
    
    // reset button
    //$('.dynamic').hide();
    $('#parseButton').show();
    $('#abortButton').hide();
    $('.freez').prop('disabled', false);
}

// ----------------------------------------------------------------------------

// set option
function setOption() {
    var where  = this.id.split('before_');
    var action = null;
    
    if (where.length > 1) {
        action = where[1];
        where  = 'before';
    }
    else {
        action = this.id.split('after_')[1];
        where  = 'after';
    }

    if (action) {
        gctl[where][action] = this.checked;
    }
}

// ----------------------------------------------------------------------------

// UI events
$('#openFileButton').on('click', openFile);
$('#saveFileButton').on('click', saveFile);

$('#inputFile').on('change', onInputFileChange);

$('#inputFileName').on('input', updateInputFileName);
$('#outputFileName').on('input', updateOutputFileName);

$('#parseButton').on('click', parse);
$('#abortButton').on('click', abort);

$('#options input').on('change', setOption);

$('#pauseBeforeTrigger, #pauseAfterTrigger').on('change', function() {
    gctl.pauseBeforeTrigger = parseInt($('#pauseBeforeTrigger').val());
    gctl.pauseAfterTrigger  = parseInt($('#pauseAfterTrigger').val());
});
