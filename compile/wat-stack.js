var Wat = require('./wat')
var isArray = Array.isArray
var pretty = require('../util').pretty
var S = Wat.S
function isSymbol(s) {
  return 'symbol' === typeof s
}
function isResult(s) {
  return isArray(s) && s[0] === S('result')
}
function _S(sym) {
  if(isArray(sym)) throw new Error('expected primitive or symbol')
  return isSymbol(sym) ? sym.description : ''+sym
}

function pretty_stack (list, indent) {
  indent = indent || ''
  if(isArray(list)) {
    if(list.length == 0) return ''
    if(isResult(list)) return indent + '  ' + pretty(list)
    if(args[list[0].description])
      return indent + list.map(_S).join(' ')
    else
      return list.map(e => pretty_stack(e, '  '+indent)).join('\n')
  }
  else
    return indent + _S(list)
}

//figured out algorithm to convert to stack machine form
//it's super easy! (would just need to support loops)
//but not using any other control structures yet so that's it.

var args = {
  'local.get': 1,
  'local.set': 1,
  'local.tee': 1,
  'global.set': 1,
  'global.get': 1,
  'call': 1,
  'i32.const': 1,
  'br':1,
  'br_if':1
}

function toStack (tree, list) {
  if(isResult(tree)) throw new Error('called toStack on result type')
  list = list || []
  if(isArray(tree)) {
    if(!tree.length) return list
    //then and else specify blocks in the sexp format
    //but mean nothing in stack format
    if(tree[0] === S('then') || tree[0] === S('else'))
      tree = tree.slice(1)
    tree = tree.filter(v => v !== null)
    //if is special case with 2 blocks
    if(tree[0] === S('if')) {
      var start = 1, result
      if(isResult(tree[1])) {
        result = tree[1]
        start = 2
      }

      toStack(tree[start], list)
      list.push(tree[0])
      if(result) list.push(result)
      //then
      list.push(toStack(tree[start+1], []))
      //else
      if(tree[start+2]) {
        list.push(S('else'))
        list.push(toStack(tree[start+2], []))
      }
      list.push(S('end'))
    }
    //nested
    else if(tree[0] === S('block') || tree[0] === S('loop')) {
      list.push(tree[0])
      if(isResult(tree[1])) {
        list.push(tree[1])
        list.push(toStack(tree.slice(2), []))
      }
      else list.push(toStack(tree.slice(1), []))
      list.push(S('end'))
    }
    else if(args[tree[0].description] == 1) {
      //toStack(tree[2], list)
      if(tree.length > 2) toStack(tree.slice(2), list)
      list.push([tree[0], tree[1]])
    }
    else if(args[tree[0].description] == 2) {
      if(tree.length > 3) toStack(tree.slice(3), list)
      list.push([tree[0], tree[1], tree[2]])
    }
    else if(tree[0] === S('local.get') || tree[0] === S('i32.const'))
      list.push([tree[0], tree[1]])
    else if(tree[0] === S('call')) {
      tree.slice(2).forEach(t => toStack(t, list))
      list.push([tree[0], tree[1]])
    }
    else if(isArray(tree) && isArray(tree[0]))
      tree.forEach(branch => toStack(branch, list))
    else {
      for(var i = 1; i < tree.length; i++)
        toStack(tree[i], list)
      toStack(tree[0], list)
    }
  }
  else
    list.push(tree)
    //throw new Error('encountered unexpected symbol')
    //list.push(tree)
  return list
}

function WatStack (ast) {
  return pretty(ast, function (tree) {
    if(isArray(tree) && tree[0] === S('func') && tree.length > 2) {
      var head = [tree[1]]
      var body = []
      tree.slice(2).forEach(e => {
        if(isArray(e) && (
          e[0] === S('param') ||
          e[0] === S('result') ||
          e[0] === S('local')
        ))
          head.push(e)
        else
          body.push(e)
      })
      return '(func '+
        head.map(v => pretty(v)).join(' ') + '\n'+
        pretty_stack(toStack(body)) + '\n)'
    }
    //else fall through
  })
}

module.exports = function (ast, env) {
  return Wat(ast, env, WatStack)
}
