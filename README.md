# mac

playing around with the idea of a macro based language.
I want it to feel like closures,
but generate static functions that are fast and can be compiled to web assembly.

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
```

easy just to inline that, so it becomes

``` js
if('string' === typeof "hello world")
```
this won't work for recursion though, unless there is a way to convert recursion to iteration.


```


## License

MIT
