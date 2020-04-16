(module
  ;; completely naive memory mismanagement,
  ;; allocate memory but never reclaim it.
  (export alloc {fun (size) [block
    ;;start of free memory stored in free global
    (def free (get_global 0))
    ;;move it forward, by the amount requested
    (set_global 0 (add free size))
    ;;return the old position.
    free
  ]})
  ;;do nothing!
  (export free {fun (ptr) 0})
)
