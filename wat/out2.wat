(module
  (memory (export "memory") 1)
  (func (param $a i32) (param $b i32) (param $d i32) (param $e i32) (param $f i32)(result i32)
    (local $1 i32)
    (local $2 i32)
    (tee_local $1 (i32.and (get_local $a) (i32.const 1)))
    (drop)
    (if
      (get_local $1)
      (then (tee_local $2 (i32.const 0)) (drop))
      (else (tee_local $2 (i32.const 1)) (drop)) )
      
    (get_local $2))
  (export "main" (func 0))
  
)
