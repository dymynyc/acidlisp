okay what about something where a loop gets unrolled
struct needs to pass in map of names and types
and get a bunch of methods that will read offsets from an object.

lets say we have a function that takes a list and maps it.
we want to just unroll the bound list. for example the stack-expression
style dsl should be fully static.

```
{fun AND (list)
  {fun (input)
    [every list {fun (test) (test input)}]
  }
}

(fun every (list)
  () true
    (if ((head list)) (every (tail list)) false)
)
```
for a static list (A B C) this could be expanded

```
  (if [A input] (if [B input] (if [C input] true false) false) false)
```

in this case, recursion makes it easier, i think.

```
(fun map (list each)
    (if
      (isEmpty list) ()
      (cat
        (each (head list))
        (map (tail list) each)
      )
)
```
which could be expanded for `(A B C)`
```
(if (isEmpty (A B C)) () => (if false () ... => ...

[cat
  (each A)
  {cat (each B)
    (each C)]}]

{fun each [list, fn]
  (if (isEmpty list) ()
     (block
      (fn (head list))
      (each (tail list) fn)
    )
  )
}

(while (not(isEmpty list))
  (block
    (each (head list))
    (set list (tail list))
  )
)

(fun map [list fn]
  (while (not (isEmpty list))  
    [cat (fn (head list)) (map (tail list) fn)]
  )
)

{fun reduce [list fn acc]
  [()] acc
    [reduce (tail list) {fn acc (head list)}]
}

(while (not (isEmpty list))
  (set acc (fn acc (head list))
  (set list (tail list))
)
acc
```

hmm, still a little complex. probably easier to provide map, each, reduce with unrolling.
