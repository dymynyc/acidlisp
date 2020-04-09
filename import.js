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
    if(ext) {
      if(ext === '.'+EXT)
        return fs.readFileSync(moduleFile, 'utf8')
      else
        //import raw data as buffer.
        return fs.readFileSync(moduleFile)
    }
    try {
      var stat = fs.statSync(moduleFile)
    } catch(err) {
      return fs.readFileSync(moduleFile+EXT, 'utf8')
    }
    if(stat.isDirectory())
      return fs.readFileSync(path.join(moduleFile, './index' + EXT))
  }

  function load (name, filename) {
    //normalize the path so that 'foo/../bar' actually means bar.
    if(path.isAbsolute(name))
      throw Error('importing absolute names is not allowed')
    if(name != path.normalize(name))
      throw new Error('importing non-canonical names are not allowed, use:'+path.normalize(name)+' instead')

    var parts = name.split(path.sep)
    var modulename = parts.shift()
    var modulePath = parts.join(path.sep)
    var importdir = dir

    //find the project base directory.
    var dir = fs.dirname(filename)
    var basedir = dir
    while(!fs.existsSync(path.join(basedir, PKG)) && basedir != '/')
      basedir = fs.dirname(basedir)

    //normally, forbid loading modules from outside the module.
    //but it would be annoying to refuse for quick scripts, so just warn, but only once.
    //include the word "Security" in it so that people take it seriously.
    if(basedir === '/') {
      if(basedir_warn) {
        basedir_warn = true
        console.error(
          'Security Warning: missing package.json,' +
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
    if(/^\./.test(path)) {
      var target = path.resolve(dir, name)
      if(target.substring(0, basedir.length) != basedir)
        throw new Error('cannot import relative modules outside basedir')
      return loadFrom(target)
    }
    while(
      !fs.existsSync(path.join(importdir, MODULES, modulename)) &&
      importdir != '/'
    )
      importdir = path.basedir(importdir)
    if(importdir === '/') throw new Error('could not resolve module:'+modulename)

    return loadFrom(path.join(importdir, modulePath))
  }

  return load

}
