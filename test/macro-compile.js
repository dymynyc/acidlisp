var {isArray,isSymbol,pretty} = require('../util')
var acid = require('../')
var Env = require('../env')
var syms = require('../symbols')
var macros = `(module
;;  [def reverse (mac (l) (list ((fun R (l)
;;    (if (is_empty l) l
;;      (if (is_empty (tail l)) l
;;        (cons R (tail l) (head l))
;;      ))
;;  ) l)))]

  [def DEF (mac (var value)
    (if (eq (head value) (quote block)) ;; it's a block
      &(block
        ;;get head+body, without tip of tail
        $(reverse (tail (reverse value)))
        ;; get tip of tail
        (DEF $var $(head (reverse value)))
      )
      &(def $var $value)
    )
  )]

  (export DEF DEF)

  [def SET (mac (var value)
    (if (eq (head value) (quote block)) ;; it's a block
      &(block
        ;;get head+body, without tip of tail
        $(reverse (tail (reverse value)))
        ;; get tip of tail
        (SET $var $(head (reverse value)))
      )
      &(set $var $value)
    )
  )]

  (export SET SET)

  [export IF (mac (test then else)
    (if (is_list test)
      &(block
        (DEF q $test)
        (if q (DEF r $then) (DEF r $else))
        r
       )
      &(block (def r 0) (if $test (SET r $then) (SET r $else)) r)
    )
  )]
)`

var src = `(IF a (IF b (IF C 3 2) 1) 0)`

var env = acid.eval(macros, Env())
console.log("P")
var ast = acid.parse(src, __filename)

console.log(
  pretty(acid.bind(ast, env))
)
console.log(
  pretty(acid.bind(acid.parse('[DEF foo (IF a b c) ]'), env))
)

console.log(
  pretty(acid.bind(acid.parse('[x [y [z (IF a b c) ]]]'), env))
)

var tree = acid.parse('(A (B 1 2) (C 3 4))')

function S(v) {
  return isSymbol(v) ? v.description : v
}
var CALL = Symbol('call')
function pretty_stack (list, indent) {
  indent = indent || ''
  if(isArray(list)) {
    if(list[0] === syms.def || list[0] === syms.set || list[0] === CALL)
      return indent + list[0].description + ' ' + S(list[1])
    else
      return list.map(e => pretty_stack(e, '  '+indent)).join('\n')
  }
  else
    return indent + S(list)
}

//figured out algorithm to convert to stack machine form
//it's super easy! (would just need to support loops)
//but not using any other control structures yet so that's it.
function toStack (tree, list) {
  if(isArray(tree)) {
    if(tree[0] === syms.if) {
      toStack(tree[1], list)
      list.push(syms.if)
      list.push(toStack(tree[2], []))
      if(tree[3]) {
        list.push(Symbol('else'))
        list.push(toStack(tree[3], []))
      }
      list.push(Symbol('end'))
    }
    else if(tree[0] === syms.set || tree[0] === syms.def){
      list.push(tree[2])
      list.push([tree[0], tree[1]])
    }
    else {
      tree.slice(1).forEach(t => toStack(t, list))
      if(tree[0] !== syms.block)
        list.push([CALL, tree[0]])
    }
  }
  else
    list.push(tree)
  return list
}

console.log(toStack(tree, []))

//var src = `(IF a (IF b (IF C 3 2) 1) 0)`
var ast = acid.bind(acid.parse('[DEF foo (IF a b c) ]'), env)
console.log(
  pretty(ast),
  pretty_stack(toStack(ast, []))
)

var ast = acid.bind(acid.parse('[x [y [z (IF a b c) ]]]'), env)
console.log(pretty(ast))
console.log()
console.log(pretty_stack(toStack(ast, [])))



var ast = acid.bind(acid.parse('[x [y [z (IF a b c) ]] (IF d e f)]'), env)
console.log(pretty(ast))
console.log()
console.log(pretty_stack(toStack(ast, [])))

console.log('**********')
var ast = acid.bind(acid.parse('[y [z (IF a b c) ]]'), env)
console.log(pretty(ast))
console.log()
console.log(pretty_stack(toStack(ast, [])))
