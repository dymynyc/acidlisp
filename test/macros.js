
var tape = require('tape')
var ev = require('../eval')
var parse = require('../parse')
var createEnv = require('../env')
var {stringify, pretty} = require('../util')

function call(mac, args) {
  var scope = createEnv()
//  scope.__proto__ = _scope
  mac = ev(parse(mac), scope)
  var r = ev.call(mac, parse(args))
  console.log(pretty(r))
  return stringify(r)
}

tape('step by step macro eval', function (t) {
  function T (mac, args, expected, scope) {
    t.equal(call(mac, '(' + args + ')', scope || {}), expected)
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

  // since a list is returned, it's the same as a quote.
  // but since we are already in eval mode, we don't need unquote
  T(`
    (mac call_mac (m args) (cons m args))
  `,
  `
  (mac (a b c) &(and $a (and $b $c)))
  (1 2 3)
  `,
  `(and 1 (and 2 3))`
  )


  t.end()
})
