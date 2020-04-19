(module

  ;;saves a set of parens and writing the name twice
  [def defmac (mac (name args body)
    &(def $name (mac $name $args $body))
  )]

  [defmac defun (name args body)
    &(def $name (fun $name $args $body))
  ]

  ;; operations on a list
  (defmac unroll (l v each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter &[block [def $v $value] $each])

    [if
      (is_empty rest)
      iter
      &(block
        $iter
        (unroll $rest $v $each))
    ]
  })

  (defmac unroll_r (l v r each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter &[block [def $v $value] $each])

    [if
      (is_empty rest)
      iter

    ]
  })

  ;; apply each to items in l until one fails
  ;; result is 0 or last value
  [defmac every (l v each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter &[block [def $v $value] $each])
    [if
      (is_empty rest)
      iter
      &(block
        (def q iter)
        (if q (unroll_and $rest $v $each))
      )
    ]
  }]

  ;; run each on each item in l until one passes
  ;; result is 0 or the pass
  (defmac find (l v each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter [list &block [list &def v value] each])
    [if
      (is_empty rest)
      &iter
      &(block
        (def q $iter)
        (if q q (find $rest $v $each))
      )
    ]
  })

  (export main (fun (n) [block
    (def sum 0)
    {unroll [1 2 3] it (def sum (add sum it))}
  ]))

)
