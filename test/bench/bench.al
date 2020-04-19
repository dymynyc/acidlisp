(module

  (def op_mac (mac (a b) (block
    &[i32_load (mod a 1000)]
  )))
  (def op_fun (fun (a b) (op_mac a b) ))

  (def N 10000000)
  (export calls (fun () {block
    (def i 0)
    (loop
      (lt i N)
      (block
        (def i (add i 1))
        (op_fun i 10) ;;call a small function 
      )
    )
  }))

  (export inlines (fun  () {block
    (def i 0)
    (loop
      (lt i N)
      (block
        (def i (add i 1))
        (op_mac i 0)
      )
    )
  }))

  (def unroll (mac R [n op]
      (if n
        (block
          (def n (sub n 1))
          &(block (R n op) op)
        )
        op
  )))

  (export unrolled (fun  () {block
    (def i 0)
    (def batch 1000)
    (loop
      (lt i N)
      (block
        (def i (add i 100))
        ;;(op_mac)
        (unroll 100 (op_mac i 0))
        0
      )
    )
  }))

)
