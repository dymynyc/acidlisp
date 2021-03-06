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
## Compiler Passes

### parse

takes the raw source and parses to ast.

### uniquify

convert variables so that no names are used twice.
this makes later passes easier. unique variable names
should not change any behavior, it should behave and type exacty the same.

### eval

eval runs next. this means imports are called,
any top level code, which may include generating functions.
output of this pass is the exports to be written to wat,
and the scope.

### unroll

takes exports and scope object, and outputs a flat scope.
for example, a module may export functions that refer to other
functions internal to that module.

### inline

convert recursive functions into loops (if possible)
and take function calls and copy the called code into the calling code.
output will include `scope` and `batch` calls, that are not used normally.

inlining makes the code faster, but larger. (in theory)
(am currently rewriting this)

if inline is used, unroll is not needed.
  
### scopify

converts scope and batch calls to ordinary defs and blocks
and normalizes all numbered variables.

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

## TODO: fix ugly hacks

* get_global set_global functions.
  instead have references like functions and strings? that are private to modules.
* non-joke memory management
* type inference?

## dev diary

### 24/6/2020

have been thinking about how to inline functions returned
from other functions. when I started this project, I only
had function constructors running in the eval stage,
then I inlined any scoped values. But now I'm thinking
about how to call a constructor at the start another function.
Unlike at eval time, there may not be enough values known to
bind all variables. Ruminating on it, I eventually realized
that every function constructor has a setup, and then a return,
(the return is a function) the setup should be inlined where
the constructor is called, but the return(ed function) is inlined
where ever it is called. Firstly, this will be outside
of the `scope` block. scope block is the wrong idea, should just
uniquify (again) when inlining, the returned fun needs to be able to
see the setup vars. Secondly, assigning functions to variables,
or returning functions sets the function in the scope but drops
the function from the code, the function is used where it is inlined.

I think because the very top level only takes numbers, we should
be able to statically compile all functions.


### 18/6/2020

okay took quite a break, couldn't really focus on computers
because the world is falling apart. that's still happening
but am used to it now. got uniquify working with scopify.
these basically do the same things now. Could I just have
one function for traversing variable names and reuse it?
scopify in particular is a bit ugly.

hmm, the tricky bit is how it's handled when two defs update
the same variable. uniquify creates two vars,
but `(def x 1) (def x (add 1 x))` becomes `(def x1 1) (def x2 (add 1 x1))`
so it's the same behavior.

loops are the other case, but users don't write loops directly,
they are made from inlined recursive functions.

maybe I can ditch scopify (except for handling `batch`)?



## 7/6/2020

hmm, for the case where the same function is inlined twice in
the same caller, unique vars will get duplicated, so still
need `scope` for that.

## 5/6/2020

I've been rewriting all the modules with inlining.
I've discovered that I don't really understand my inlining
algorithm. I'm gonna rewrite it, with a different focus.
Start by handling the higher order functions, rather than
inlining literals (come back to that). I think scope was the wrong
idea. It didn't work for when a deep closure references an outer scope.
This time I'm gonna use `batch` when inlining a function (rather
than doing substitutions) but the first step is renaming all vars
so that everything is unique. Then inlining will be easy, won't have
to think about remapping things...

use batch to inline a function call. This will make a bunch of extra
variables, but then remove extras in a subsequent pass.

## 24/5/2020

Have been rewriting things again I wrote with macros using
functions and recursion. It's coming out for more elegantly
than it did with iteration. Implementing inlining was challenging.
prehaps more challenging than macros? but using functions is easier
and it's a clean abstraction. Inlining isn't perfect yet.
I've been encountering a few problems where the scoping isn't quite
right. Scope blocks worked well. A current problem is inlining
recursive loops, when they are called using the same variable names.

I am now considering `unscope` it would allow you to refer to a variable outside
the current scope, so `(block (def a 1) (scope (def a 2) (unscope a)))` would evaluate to 1.

Another approach would be a way to set variables as a batch, easy
to implement in the interpreter: eval the args, then assign the symbols.
The compiler on the other hand would need to check for cases where
a var is used to set another var like `(batch_def [a b] [b a])`
actually I need this to inline functions correctly... I guess that's
the answer.




## 20/5/2020

implemented scope blocks. does a recursive check first, doesn't
add a scope unless there is a def. a  scope that doesn't contain
a def doesn't do anything. the advantage of this is just to make
the intermediate output simpler, which makes the tests nicer,
but that's important.

Not sure how this will work for big unrolled loops, i.e. implementing
a hash function. It might create many many variables, instead of reusing
them. It's probably easier to have another pass that minimizes the
number of variables.

## 19/5/2020

idea: scope block. it works like a block, but has a new scope.
any def statements inside the do not override the parent scope.

## 17/5/2020

okay I got inlining actually working, including loops
but I need to inline with hygene and there is already
too much code.

### 16/5/2020

nearly got inlining on exported modules, works for some tests,
or demos, but not everything yet...

### 14/5/2020

looked at inlining again. I think it's a really good idea.
much better than macros, but also the code I have for it
currently isn't very complete. cases like:
* what if arguments to a function are expressions?
* detect if a recursive function is evalable or inlinable?
  (evalable meaning it can be substituted for it's value, inlinable
  meaning it's body can be copied into the current scope, body
  with prehaps some evaling)
* there are some things that we want always to be inlined,
  such as loops on list literals.

### 10/5/2020

experimenting with removing macros is going well.
inlining is exciting. it's gonna run really fast.
I figured out a way to turn simple recursion into loops.
I think maybe acid lisp just won't have loops, apart from
recursion... and maybe not mutable variables either.
because these are both tricky to inline.

And functions are way more composable!

I did a test in javascript, and the same simple function
written as a loop was 20 times faster than as recursion.
I thought JS was meant to be fast?
If we rewrite recursion as loops, then you can write
nice high level code but it'll be as fast as it can be.

### 3/5/2020

I considered variable args, but it was too daunting.
Instead I implemented a hashtable, which I need to parse
symbols (because I want two identical symbols to have the
same address) Got it working, and for the first time,
wrote the tests in acid too.
There is definitely a problem with macros, but it only
seems to happen when exporting them.
I had a macro that I both exported and used inside
of acid-hashtable, but the inside one couldn't call
a function also in that package. It was compiled with
the wrong name. I havn't used macros as much as I thought I
would, and they still have some weird bugs.

Also, I had some ideas about type checking. I think for a
forwards-only type checker (not type inference, your exports must be typed)
then implementing a type checker is as easy as implementing
an interpreter. Types are just Values. Take the interpreter
and execute it on the same ast, but redefined the operators
to operate on types so `x + y = z` becomes `int + int = int`

I am now wondering if I can use a approach like this to do thing
like ensure that function X is always called before Y, or
that something eventually happens.

### 2/5/2020

researched type inference. also refactored complier.
deleted flatten, and generate wat ast, then stringify.
preparing to switch to stack form, then output binary.
then won't need wat2wasm! then you'll only need to install js!

Then I need variable args, and it will be time to start implementing
this in itself!

### 30/4/2020

via a very close reading of the spec, while attempting
to write a binary parser, I realized that blocks have types!
if you give it a type it becomes an expression. this means
I can delete flatten.js

tried to install wasmer... didn't work. I think this is about
my computer though. but still for fuck sake why is installing
some software so hard!?

### 29/4/2020

The last couple of days I've been working on IO.
I can't use WASI because it's blocking. Those apis won't well on the web.
And would you want blocking api's anyway? Now I'm getting into
serious coding with acid, I'm learning which things need the most
improvement. One thing is that and is wrong. it's bitwise and, not
logical and. This caused me several hours of extra debugging!

The IO pattern I came up with is designed to give as much freedom
to the implementer of the wasm. It should be easy to interface
with from C or Rust etc. But it's not exactly easy.

This has all given me some good ideas though:
* can I reimplement most of the compiler just with macros?
  I think I can replace flatten with macros. That means I can
  start implementing acid in acid.
* I know I'm gonna need types. If I had a function map lookup
  get an array of functions, then call the one that matches the
  call signature, then I could have variable arguments. (aka overloading)
* Also, the binary format is much closer to the stack, not the s-exp
  format, so if flatten produces that it would be much easier
  to compile (wouldn't need wat2wasm then!)

I experimented with using macros to do the transform to keep
everything expressions, _and_ I figured out the algorithm
to flatten the ast into the stack form. it was easy. that means
outputting the binary format won't be very hard!

I also started thinking that maybe every struct should have a pointer
to it's class (i.e. a schema, of the fields) this would add 4 bytes
of overhead per object, but enable run time type checks, theirfore,
reflection. I wanted it to feel dynamic. Pretty sure I need this
for the interpreter anyway. It would also enable garbage collection.
I don't want to enforce GC but sometimes it's useful.

I say "class" but of course I'm not gonna have actual class definitons.
that would be most uncool. obviously you just create object literals
and the "classes" are implied. This would also work for creating
closure scopes, when needed.

### 22/4/2020

I fixed the scope problem pretty easily to day.
the problem was that quotes where transforming vars
(to add hygene) but it wasn't traversing into def values
(which can contain more defs)

I got to capturing groups, but then with multiple layers
of Many or More patterns something wasn't quite right.
sometimes a Many steals extra characters. Reading the
generated code is really hard. It doesn't help that
flatten sticks quite a few extra variables in there.

I think the next thing is to implement logging.
then i might be able to figure out what is going on.

### 21/4/2020

okay more wrestling with macros. thought a lot about
how to do structs. implemented cons and other list stuff.
was just about to have the parser do captures but
hit a problem with modules. somehow the module falls
off the scope? maybe it's time for stack traces!

I figured out that the scope problem is about when a macro expands
something. I'm writing macros that call macros several layers
deep. The parse macros are calling string reading macros and
cons creating macros. I think the problem is that it's passing
the macros in unexpanded, then expanding them on the way out.
But it does this in the scope of the macros just called, which
can't see the scope the call was created in.


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
