(module
  (def strings (import "./strings"))

  (def _match (mac R (str i) (block
    (def len (strings.length str))
    (if (eq i (sub len 1))
      &(if (eq (strings.at input (add start $i)) $(strings.at str i)) len -1)
      &(if (eq (strings.at input (add start $i)) $(strings.at str i))
        (R $str $(add 1 i)) -1)
    )
  )))

  (def Match (mac (str) (list _match str 0)))

  (def Or (mac (a b)
    &(if (neq -1 (def m $a)) m (if (neq -1 (def m $b)) m -1))
  ))

  (def And [mac (a b)
    &{block
      (def _start start) ;;_start will be made hygenic
      (if
        (neq -1 (def m1 $a))
        [block
          (set start (add _start m1))
          (if
            (neq -1 (def m2 $b))
            (add m1 m2)
            (block (set start _start) -1)
          )
        ]
        (block (set start _start) -1)
      )
    }
])

  (def Many [mac (a) &{block
    (def m2 0)
    (loop (neq -1 (def m $a))
      (block
        (set start (add start m))
        (set m2 (add m2 m))
      )
    )
  }])

  (def More [mac (a) &{block (And $a (Many $a)) }])

  ;;returns the number of characters matched.
  ;;HELLO THERE   => 11
  ;;HELLO WORLD   => 11
  ;;HELLO WORLD!  => 12
  ;;HELLO WORLD!! => 13
  ;;HELLO WORL    =>  -1

  (def hello_world (fun (input start)
    (And
      (Match "HELLO ")
      (Or (Match "THERE") (Match "WORLD"))
      (Many (Match "!")))))

;; if i could automatically convert strings,
;; and supported variable args somehow...
;;    (And "HELLO " (Or "THERE" "WORLD") (Many "!"))
)

  (def hello_world (fun (input start)
    (And
      (Match "HELLO ")
      (Or (Match "THERE") (Match "WORLD"))
      (Many (Match "!")))))

    (And "HELLO " (Or "THERE" "WORLD") (Many "!"))
)


  (export hello_world)
)
