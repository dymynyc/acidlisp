var {AND,OR,MAYBE,MORE,JOIN,RECURSE,GROUP,TEXT,EMPTY}  = require('stack-expression')

//mandatory whitespace
var __ = /^\s+/

//optional whitespace
var _ = /^\s*/

var value = RECURSE ()

var symbols = require('./symbols')
//note: json's value types already capture.
var {string, number, boolean} = require('stack-expression/examples/json')
var sym = TEXT(/^[a-zA-Z;_][a-zA-Z0-9_]*/, function (text) { return symbols[text] || Symbol(text) })

var nil = TEXT(/^nil/, function () { return null })
var contents = GROUP(MAYBE(JOIN(value, __)))
var list_round = AND('(', _, contents,  _, ')')
var list_square = AND('[', _, contents,  _, ']')
var list_curly = AND('{', _, contents,  _, '}')

function PREFIX (str, sym) {
  return GROUP(AND(str, value), e => [Symbol(sym), e[0]])
}

var list = OR(list_round, list_square, list_curly)
var easy_value = OR(list, string, number, nil, boolean, sym)

var quote = PREFIX("&", 'quote')

//morning thought: infix style?
// (foo a b) -> a ~foo b
// (bar (foo a b) c) -> a ~foo b ~bar c
// second foo must be parens, you'd need parens anyway.
// (bar c (foo a b)) -> c ~bar (foo a b)


//The following is a performance hack!
//the most obvious way to do this involved
//too much back tracking and any slightly non-trivial
//string was really slow to parse.

var shortcuts = GROUP(AND(easy_value, OR(
    AND(_, ':', _, easy_value), //pair
    GROUP(MORE(AND(_, '.', _, easy_value)), e => [symbols.get, null].concat(e)),
    EMPTY//empty
  )), (e) => {
    if(e.length === 1) return e[0]
    else if(e[1] === symbols.get)
      return e[1][1] = e[0], e[1]
    else
      return [e[0]].concat(e[1])
  })

value(OR(quote, shortcuts))

/*
//this is what it used to be like!
//leaving this here because it's an instructive!
//this was much more elegant, but way way too slow.
//one example, that only had 15 lists
//was taking 5 seconds to parse with this code.
//with the fix it's 4 ms!

function PAIR (sep, name) {
  return GROUP(AND(easy_value, _, sep, _, easy_value), e => (name ? [name] : []).concat(e))
}

function JOIN_MUST (separator, name) {
  return GROUP(AND(easy_value, MORE(AND(_, separator, _, easy_value))), e => name ? [name].concat(e) : e)
}

var pair = PAIR(':')
var chain = JOIN_MUST('.', 'get')

value(pair, chain, quote, easy_value)
*/

var root = AND(_, value, _)

module.exports = function (src) {
  var out = root(src, 0)
  if(out.length != src.length)
    throw new Error('failed to parse fully:'+src)
  return out.groups[0]
}
