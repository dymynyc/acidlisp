
var tape = require('tape')
var ev = require('../eval')
var parse = require('../parse')
var createEnv = require('../env')
var {stringify, pretty} = require('../util')

function call(mac, args, I) {
  var scope = createEnv()
//  scope.__proto__ = _scope
  mac = ev(parse(mac), scope)
  var r = ev.call(mac, parse(args))
  console.log(pretty(r))
  return stringify(r)
}

tape('step by step macro eval', function (t) {
  var i = 0
  function T (mac, args, expected, scope) {
    t.equal(call(mac, '(' + args + ')', scope || {}, 'macro_'+(i++)), expected)
  }

  T('(mac (x) &{set $x (add $x 1)})', 'z', '(set z (add z 1))')
  T('(mac (x) &(add $x 1))', 'z', '(add z 1)')
  T(`
      (mac R (x c)
        (if (lte c 0) $x &(add 1 (R $x $(sub c 1))))
      )
    `,
    'z 3',
    '(add 1 (add 1 (add 1 z)))'
  )

  T(`
    (mac R (m i c)
      [if (lte c 0) &[$m $i] &($m (R $m $i $(sub c 1))) ]
    )
    `,
    '(mac (a) &(mul 2 $a)) 1 5',
    '(mul 2 (mul 2 (mul 2 (mul 2 (mul 2 (mul 2 1))))))'
  )

  T(`
    (mac MAP (l1 l2 map)
      (if
        [or (is_empty l1) (is_empty l2)]  0 ;; should be an error
        (if
          [or (is_empty (tail l1)) (is_empty (tail l2))]
          &($map $(head l1) $(head l2))
          &(and
            ($map $(head l1) $(head l2))
            (MAP $(tail l1) $(tail l2) $map)
          )
        )))
    `,
    '(1 2 3 4 5 6) (1 2 30 4) (mac (a b) &(eq $a $b))',
    '(and (eq 1 1) (and (eq 2 2) (and (eq 3 30) (eq 4 4))))',
    {sum: 0}
  )

  T(`
    (mac R (l i) {block
      (def sum (add (head l) i))
      (if (is_empty (tail l))
        sum
        (cat
         [list &list sum]
         [R $(tail l) $sum]
        )
      )
    })
  `,
  '(1 2 3 4 5) 0',
  '(list 1 3 6 10 15)'
  )
  //way easier to do that using iteration!
  T(`
    (mac R (l) {block
      (def out [list &list])
      (def sum 0)
      (loop (eq 0 (is_empty l))
        (block
          [set sum (add (head l) sum) ]
          (set out (cat out [list sum]))
          (set l (tail l))
        )
      )
      out
    })
  `,
  '(1 2 3 4 5)',
  '(list 1 3 6 10 15)'
  )


  t.end()
})
