# Acid Lisp - _acid eats rust_

Playing around with the idea of a macro based language.
I want it to feel like closures,
but generate static functions that are fast and can be compiled to web assembly.

## goals

* no standard lib, everything is modules. published early, and independently versioned.
* lightweight output. this should come naturally because it's targeted directly at wasm so there won't be a big runtime.
* self hosting.
* minimal code. it should be possible to understand the whole thing.
* all tools needed should be runnable in the browser!

## usage

you'll need to install the `wabt` tools.
```
git clone https://github.com/dominictarr/acidlisp
cd acidlisp
./load.js path_to_al_file > out.wat
wat2wasm out.wat #wat2wasm from wabt (web assembly binary tools)
```

## modules

`acid` has a module system inspired by node.js's. This is in my opinion
a most underrated module system, mainly because it avoids the problem
of version conflicts - you can simply have more than one version of
the same thing! yes, this can make a larger output, but, that's
something you can fix when you have time. With version conflicts
there is a very strong disincentive to making breaking changes,
which means you get stuck with bad ideas longer.

## status

In development. currently I have a simple expression
based language that successfully compiles to wasm.
There are a bunch of hoops to jump through here.
One thing is that in a lisp, everything should be an
expression. That means that any piece of code evaluates
to a value, and can be the input to another expression.
But wasm isn't always like that. Somethings are
statements and can't have return values. And sometimes
it complains that there is a value somewhere that it
wasn't expecting it.

To get around this, code is tranformed so that expressions
become statements.

one example is an if statement. `(if test (then ...) ( else ...))`
in wasm you cant do `(add 7 (if foo 5 10))` but I want to be able to!
but we can make it work like that by transforming the statement.
``` js
(if foo (set $1 5) (set $1 10))
(add 7 $1)
```
(note: I've left 7 in the same place for clarity.
if it was a more complicated expression that updated
something it's possible that the behaviour changed.
so we'll need to move it out too. However, if all
the are pure expressions then the call order can change
but the behaviour will stay the same)

Currently only i32 values are supported.

## syntax

started with lisp, because it's easiest - both to implement and work with.
it's a little hard to know all your parens are ballanced though, so I extended it slightly.

you can use any sort of braces `()[]{}` the following are all equivalent.
``` js
(foo bar baz)
[foo bar baz]
{foo bar baz}
```
but each brace must match their own kind.
``` js
(foo [bar {baz}])
```
there are some infix notations too. `a: b` is the same as `(a b)`
so the following are the same
```
(foo: 1 bar: 2 baz: 3)
[(foo 1) (bar 2) (baz 3)]
```
"property access" via `foo.bar` is a shortcut for `(get foo bar)`
-> shortcut for function. `(a b c) -> (add a b c)` is `{fun [a b c] (add a b c)}`

## expanding

in javascript we have closures, but in web assembly there are not closures.

### bind free variables

one way I want to use closures is already quite macro like, a function that returns a function.

``` js
function outer (free) {
  return function inner (a, b) {
    return something(free, a, b)
  }
}
```
the outer function sets a free variable in the inner function. this is easy to implement.
when evaluating the inner function just replace any free variables.

### function calls to bound variables can be collapsed

if a function calls literals `(add 1 2)` we can collapse that in place.
so after we've bound the free variables, we can check if there are any function calls
that can be bound also.

Of course, this only works with pure functions. But I'm planning to have code to test if
functions are pure...

### create a scope struct with free variables on it

``` js
var size = 0
map(array, function (item) {
  size += item.size
  return transform(item)
})
```
convert that to:

``` js
function _map_item (scope, item) {
  scope.size += item.size
  return transform(item)
}

var size = 0
var scope = {fn: _map_item, size}
map(array, scope)
```
this is somewhat more complicated, though.
It needs a pointer to a struct that also has a function pointer. this would mean unrolling map
two different ways. for a really simple map like this, it might just be easier to inline the whole
map function?

### inline functions

lets say we have convienince functions like

``` js
var isString = (s => 'string' === typeof s)


if(isString("hello world"))

//by the time inner is returned, ary isn't bound, but fn is
//so can inline
function outer (fn) {
  return function inner (ary) {
    map(ary, fn)
  }}

//array isn't bound, so can't bind map call
//iter has a free var (sum) so we can't spin it out
//we need to inline each+iter
function (array) {
  (def sum 0)
  [each array {fun iter (x) (set sum (add sum x)) }]
}

function match (rule) {
  return function (input) {
    return [rule input] //rule is free variable, but it's a bound function, so inline it.
  }
}
```

easy just to inline that, so it becomes

``` js
if('string' === typeof "hello world")
```
this won't work for recursion though, unless there is a way to convert recursion to iteration.

### structs as arguments

``` js
{fun inc_prop ((foo type)) [
  (set foo.prop (add (get foo.prop) 1))
  foo
]}

```

`(foo type)` expands to a pointer when compiled.
`(get foo.prop)` expands to `(read_type (add foo_ptr prop_offset))`
`(set foo.prop)` expands to `(write_type (add foo_ptr prop_offset) (read_type (add foo_ptr prop_offset)))`
`foo` expands to `foo_ptr`
```

## TODO: fix ugly hacks

* get_global set_global functions.
  instead have references like functions and strings? that are private to modules.
* $literals$ string needs something to prevent collisions from modules.
* hygenic macros btw
* non-joke memory management
* cli args (output different formats)
* type inference?

## dev diary

### 21/4/2020

okay more wrestling with macros. thought a lot about
how to do structs. implemented cons and other list stuff.
was just about to have the parser do captures but
hit a problem with modules. somehow the module falls
off the scope? maybe it's time for stack traces!


### 20/4/2020

rewrote eval the other day, then fixed more bugs that were breaking
macros. I'm getting much better at them. I started porting
[stack-expression](https://github.com/dominictarr/stack-expression)
to acid. Next is figure out how to handle capture groups.

### 17/4/2020

I had been trying to think of a catchy name. I decided
_acid lisp_ because it needs to some sort of joke.
and acid eats rust. do I really think I can make a better
language than rust? well I certainly think I can make a simpler
one. it's good to set your sights high.


### 14/4/2020

Just discovered a huge bug. I've been refactoring the js interpreter
to behave more like wasm, to use pointers to strings, so that it
can run tests on the same lib/strings module. But `concat` had a
`(def i 4)` left in it (before I removed the iteration) and because
the references to copy where being brought in, their variables
were being bound as if it was a local definition! (THAT IS WRONG)
it was binding `(def i 0)` to be `(def 4 0)` and also the `i`
inside the loop... so it wasn't hitting the bounds. infinite loop!
guess this is the sort of fun bug you get when you write a language!

obviously the way I'm handling function references is totally wrong.
a reference should not look like an inline. I got everything working
I think I wanna go back to working on the parser and cycle back to this.


## License

MIT
