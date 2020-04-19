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
    (def iter [list &block [list &def v value] each])

    [if
      (is_empty rest)
      iter
      &(block
        $iter
        (unroll $rest $v $each))
    ]
  })


  ;; each on l until one fails
  ;; AND is similar to EVERY, evaluates until something fails.
  [defmac unroll_and (l v each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter [list &block [list &def v value] each])
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
  ;; OR is similar to FIND. evaluates until something matches.
  (defmac unroll_or (l v each) {block
    (def value (head l))
    (def rest (tail l))
    (def iter [list &block [list &def v value] each])
    [if
      (is_empty rest)
      &iter
      &(block
        (def q $iter)
        (if q q (unroll_or $rest $v $each))
      )
    ]
  })

  (export main (fun (n) [block
    (def sum 0)
    {unroll [1] it (def sum (add sum it))}
  ]))

)
