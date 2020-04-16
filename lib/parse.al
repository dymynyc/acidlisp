(module
  (def strings (import "./strings"))
  (def match (fun (expect) (block
    (def e_len (strings.length expect))
    [fun (input start)
      (if (strings.equal_at input start expect 0 e_len)
        e_len 0)]))
  )

  (def AND (fun (rules) {fun (input start) {block
      (def c 0) ;;matched chars
      ;; recursive self evaluating macro
      [[mac R (test rest)
        {if
          (is_empty rest)

          ;; if the rest is empty, run last test and stop
          (quote (if
            (def m (test input start)) ;;final return  value
            (add c m)
            0))
          
          [quote [block
            ;; run on each item
            (def m (test input start))
            (if (gte m 0) ;; test to continue
              {block      ;; action on each item
                (def start (add m start))
                (def c     (add m c )) ;; return value if all match
;;                (R (head rest) (tail rest))
              }
              -1) ;;action on stop
          ]]
        }
      ] (head rules) (tail rules)]
  }}))

  (def f (match "foo"))
  (def b (match "bar"))

  (export foo f)
  (export bar b)

  (export foobar (AND [list f b]))
)
