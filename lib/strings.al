(module
  ;; string format: length(i32) data(bytes){length}
  (def mem (import "./memory"))

  (def min {fun [x y] (if (lt x y) x y)})
  (def length {mac [w] &(i32_load $w)})

  (def at (mac [s i] &{i32_load8 (add 4 $s $i)}))

  (def set_at (mac [s i v] &{i32_store8 (add 4 $s $i) $v}))

  (def create (mac (len) &{block
    (def s (mem.alloc (add 4 $len)))
    (i32_store s $len)
    s
  }))

  (def incr {mac [d] &(def $d (add $d 1))})

  (def each {mac [v start end iter]
    &(block
      (def $v $start)
      (loop
        (lt $v $end)
        [block $iter (incr $v)]
      ) )})

  (export length length)
  (export equal_at {fun [a a_start b b_start len] (block
    ;; minimum lengths to compare.
    (def min_len (min len (min
          (sub (length a) a_start)
          (sub (length b) b_start))))

    ;; if neither string is long enough, return false
    (if
      (neq min_len len)
      0
      [block
        (def i 0)
        (loop {and
            (lt i len)
            [eq (at a (add a_start i)) (at b (add b_start i))] }
          (incr i) )
        ;;if we got to the end it means they are equal
        (eq i len)
      ]
    )
  )})

  (export compare {fun [a b] (block
    (def len [add { min (length a) (length b)}])
    (def i 0)
    (if
      ;; if min length is zero, is the other one longer?
      (eq len 0) (sub (length a) (length b))
      {block
        (loop
          {and (lt i len)
               [eq (def r [sub (at a i) (at b i)]) 0]}
          (incr i)
        )
        (if (lt i len) r 0)
      }
    )
  )})

  (export slice {fun (str start end) [block
    (def len [sub (if end end (length str)) start])
    (def _str (create len))
    (def i 0)
    (loop
      [lt i len]
      {block
        [set_at _str i {at str (add start i)}]
        (incr i)})
    _str
  ]})

  (def copy {fun (source s_start s_end target t_start) [block
  ;;  (def i 0)
    ;;haha, some bounds checking and errors would be good here
    (each i 0 s_end
      (set_at target [add t_start i] (at source (add s_start i)))
    )
    0
  ]})

  (export copy copy)
  (export concat {fun (a b) [block
    (def c (create [add (length a) (length b)]))
    (copy a 0 (length a) c 0)
    (copy b 0 (length b) c (length a))
    c
  ]})
)
