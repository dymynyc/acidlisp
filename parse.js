var string = require('wasm-string/stack-expression')
var {
  AND,OR,MAYBE,MORE,MANY,FAIL,JOIN,
  RECURSE,GROUP,TEXT,EMPTY,EXPECT,EOF
}  = require('stack-expression')

module.exports = function (src, filename) {
  if(!filename)
    console.error('pass filename to enable informative stacktraces')
  var lines = [0]
  var chars = 0
  for(var i = 0; i < src.length; i++) {
    if(src[i] === '\n') lines.push(chars)
    chars++
  }

  //mandatory whitespace (includes ;; comments)
  var __ = /^(?:(?:\s)|(?:;;[^\n]*))+/

  //optional whitespace (includes ;; comments)
  var _ = /^(?:(?:\s)|(?:;;[^\n]*))*/

  var value = RECURSE ()

  var syms = require('./symbols')
  //note: json's value types already capture.
  var {number, boolean} = require('stack-expression/examples/json')
  var sym = TEXT(/^[a-zA-Z;_][a-zA-Z0-9_]*/, function (text) { return syms[text] || Symbol(text) })

  var describe_easy = 'number, string, boolean, nil, symbol, or list'
  var describe_value = 'number, string, boolean, nil, symbol, list, pair, property chain, or quote'

  function meta(fn) {
    return function (group, start) {
      if(fn) group = fn(group, start)
      //could make this faster using binary search.
      //I thought I could just remember the last
      for(var i = 0; i < lines.length && lines[i+1] < start; i++);
      group.meta = {start, line: i+1, column: start - lines[i] + 1, filename}
      return group
    }
  }

  function META (rules, map) {
    return GROUP(rules, meta(map))
  }

  var nil = TEXT(/^nil/, function () { return null })
  var contents = META(MAYBE(JOIN(value, __)))
  var list_round = AND('(', _, contents,  _, EXPECT(')', ') or value'))
  var list_square = AND('[', _, contents,  _, EXPECT(']', '] or value'))
  var list_curly = AND('{', _, contents,  _, EXPECT('}', '} or value'))

  function PREFIX (str, sym) {
    return META(AND(str, EXPECT(value, describe_value)), e => [sym, e[0]])
  }

  var list = OR(list_round, list_square, list_curly)
  var easy_value = OR(list, string, number, nil, boolean, sym)

  var quote = PREFIX("&", syms.quote)
  var unquote = PREFIX("$", syms.unquote)

  //morning thought: infix style?
  // (foo a b) -> a ~foo b
  // (bar (foo a b) c) -> a ~foo b ~bar c
  // second foo must be parens, you'd need parens anyway.
  // (bar c (foo a b)) -> c ~bar (foo a b)

  //The following is a performance hack!
  //the most obvious way to do this involved
  //too much back tracking and any slightly non-trivial
  //string was really slow to parse.

  var shortcuts = META(AND(easy_value, OR(
      AND(_, ':', _, EXPECT(easy_value, describe_easy)), //pair
      META(MORE(AND(_, '.', _, EXPECT(easy_value, describe_easy))), e => {
        return [syms.get, null].concat(e)
      }),
      EMPTY
    )), (e) => {
      if(e.length === 1) return e[0]
      else if(e[1][0] === syms.get)
        return (e[1][1] = e[0]), e[1]
      else
        return [e[0]].concat(e[1])
    })

  value(OR(quote, unquote, shortcuts))

  var root = AND(_, value, _, EOF)

  return root(src, 0).groups[0]
}

module.exports.string = string
