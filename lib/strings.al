(module
  ;; string format: length(i32) data(bytes){length}
  (def mem (import "acid-memory"))

  (def min {fun [x y] (if (lt x y) x y)})
  (def length {fun [w] (i32_load w)})

  (def at (fun [s i] {i32_load8 (add 4 s i)}))

  (def set_at (fun [s i v] {i32_store8 (add 4 s i) v}))

  (export length length)
  (export at at)
  (export set_at set_at)

  (def create (fun (len) {block
    (def s (mem.alloc (add 4 len)))
    (i32_store s len)
    s
  }))

  (def range (fun (start end initial reduce)
    ((fun R (acc i)
      (if (lt i end) (R (reduce acc i) (add 1 i)) acc)
    ) initial start)
  ))

  (export equal_at {fun [a a_start b b_start len]
    (if
      ;; if neither string is long enough, false
      (gt len (min
        (sub (length a) a_start)
        (sub (length b) b_start) ))
      0
      (range 0 len 1
        (fun (acc i) (and acc (eq
              (at a (add a_start i))
              (at b (add b_start i)) ))) )
    )})

  ;; compare each character up to length of shortest input
  ;; else the long one is greater
  (export compare {fun [a b]
    (or
      (range 0 {min (length a) (length b)} 0
        (fun (acc i) [or acc (sub (at a i) (at b i))]
      ))
      (sub (length a) (length b))
    )
  })

  (export slice {fun (str start end) [block
    (def len [sub (if end end (length str)) start])
    (def _str (create len))
    (range 0 len 0 (fun (acc i)
      [set_at _str i {at str (add start i)}]
    ))
    _str
  ]})

  ;;haha, some bounds checking and errors would be good here
  (def copy {fun (source s_start s_end target t_start)
    (range 0 (sub s_end s_start) 0 (fun (acc i) ;;all the way to end
      (set_at target [add t_start i] [at source (add s_start i)])
    ))
  })

  (export copy copy)
  (export concat {fun (a b) [block
    (def c (create [add (length a) (length b)]))
    (copy a 0 (length a) c 0)
    (copy b 0 (length b) c (length a))
    c
  ]})
)
