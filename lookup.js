var {
  isSymbol, isFun, isBasic, isFunction, isArray, isObject, isNumber,
  isMac, isDefined, parseFun,pretty, isBoundFun, isBoundMac, isSystemFun,
} = require('./util')

var syms = require('./symbols')

function find (ary, iter) {
  var value
  for(var i = 0; i < ary.length; i++)
    if(isDefined(value = iter(ary[i])))
      return value
}

function getValue(value) {
  return isFunction(value) ? value : value.value
}

function toName(sym) {
  return (
    isSymbol(sym) ? sym.description
  : isArray(sym) ? sym.map(toName).join('.')
  : '' + sym
  )
}

module.exports = function lookup(scope, sym, doThrow) {
  var value
  if(isArray(sym)) {
    if(sym[0] === syms.get)
      sym = sym.slice(1)
    value = scope
    for(var i = 0; i < sym.length; i++) {
      if(isArray(value)) {
        value = find(value, ([k,v]) => {
          if(k.description === sym[i].description) {
            return v //XXX
          }
        })
      }
      else if(isObject(value) && isObject(value[sym[i].description])) {
        value = getValue(value[sym[i].description]) // XXX .value
      }
      else if(doThrow !== false)
        throw new Error('could not resolve:'+toName(sym))
      else
        return undefined
    }
    return value
  }
  if(!isSymbol(sym))
    throw new Error('cannot lookup non-symbol:'+sym)
  if(!isDefined(scope[sym.description])) {
    if(doThrow !== false)
      throw new Error('cannot resolve symbol:'+String(sym))
    return undefined
  }
  value = getValue(scope[sym.description])
  if(undefined === value) {
    if(isArray(value)) throw new Error('expected:{value:...}, got:' + sym.description +'='+pretty(value))
  }
  return value //isFunction(value) ? value : value.value
}
