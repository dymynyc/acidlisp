(module
  (func (result i32)
    (local i32)
    (block
       (local.set 0 (i32.const 42))
    )
    (local.get 0)
  )

  (func (param i32) (result i32)
    (local i32)
    (if (local.get 0)
      ;;drop after tee prevents type mismatch, since then should be null type
      (then (local.tee 1 (i32.const 0)) (drop))
      (else (local.tee 1 (i32.const 1)) (drop))
    )
    (local.get 1)
  )
  (export "fortytwo" (func 0))
)
