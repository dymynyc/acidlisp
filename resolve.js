var fs = require('fs')
var path = require('path')

module.exports = function (MODULES, EXT, PARSE, PKG) {
  if(EXT[0] != '.')
    throw new Error('extention must start with ".", was:'+EXT)

  var basedir_warn = false

  function loadFrom(moduleFile) {
    //if it's a directory, load index.l6
    //if it's not, assume it's a file. so just append the correct extention.

    //if module name includes extention, just load exactly that.
    //if the extention is not .l6 then load it as _data_.
    //it will produce a single statically bound wasm bundle.
    //note: wasm data sections wat format is a string,
    //but can do \hh hex format escapes.
    var ext = path.extname(moduleFile)
    if(ext)
      return moduleFile
    try {
      var stat = fs.statSync(moduleFile)
    } catch(err) {
      return moduleFile+EXT
    }
    if(stat.isDirectory())
      return path.join(moduleFile, './index' + EXT)
  }

  function resolve (name, dirname) {
    //normalize the path so that 'foo/../bar' actually means bar.
    if(path.isAbsolute(name))
      throw Error('importing absolute names is not allowed')
    var norm = path.normalize(name)
    //keep relative link 
    function isLocalDir(f) {
      return /^\.\/+/.test(f)
    }
    if(isLocalDir(name) && !isLocalDir(norm)) norm = './'+norm
    if(name != norm) {
      throw new Error('importing non-canonical names are not allowed, use:'+path.normalize(name)+' instead of:'+name)
    }

    var basedir = dirname
    var parts = name.split(path.sep)
    var modulename = parts.shift()
    var modulePath = parts.join(path.sep)
    var importdir = dirname

    //find the project base directory.
    while(!fs.existsSync(path.join(basedir, PKG)) && basedir != '/')
      basedir = path.dirname(basedir)

    //normally, forbid loading modules from outside the module.
    //but it would be annoying to refuse for quick scripts, so just warn, but only once.
    //include the word "Security" in it so that people take it seriously.
    if(basedir === '/') {
      if(basedir_warn) {
        basedir_warn = true
        console.error(
          'Security Warning: missing '+PKG+' file,' +
          'could import modules from anywhere')
      }
    }
    else {
      //if the imported module is _THIS_ module, then import a module from here.
      //always wanted this, because it makes examples and not have relative
      //requires, so will work copied into other modules.
      pkg = PARSE(fs.readFileSync(path.join(basedir, PKG)))
      if(pkg.name === modulename) {
        return loadFrom(path.join(basedir, modulePath))
      }
    }
    //check if path is relative.
    if(/^\./.test(name)) {
      var target = path.resolve(dirname, name)
      if(target.substring(0, basedir.length) != basedir)
        throw new Error('cannot import relative modules outside basedir')

      return loadFrom(target)
    }

    while(
      !fs.existsSync(path.join(importdir, MODULES, modulename)) &&
      importdir != '/'
    ) {
      importdir = path.dirname(importdir)
    }
    if(importdir === '/') throw new Error('could not resolve module:'+modulename)
    return loadFrom(path.join(importdir, MODULES, modulename, modulePath))
  }

  return resolve
}
