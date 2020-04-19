(module
  (def macros (import "./macros"))
  (export (mac (defs imp)
    (block
      (def module $imp)
      (cons &block
        (macros.map defs e (def e (get module (head (rest e)) ))
      )
    )
  ))
)
