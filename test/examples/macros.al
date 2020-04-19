(block
  (def defun (mac (name args body)
    (quote
      (def (unquote name) (fun (unquote name) (unquote args)
        (unquote body)
      )
  ))

  (def defmac (mac (name args body)
    (quote
      (def name (mac (unquote name) (unquote args)
        (unquote body)
      )
  ))

  (def incr (mac (x) {set x (add x 1)}))
  (def decr (mac (x) {set x (add x -1)}))


  (defun three () {block
    (def x 0)
    (incr x)
    (incr x)
    (incr x)
  })

  (three)
)
