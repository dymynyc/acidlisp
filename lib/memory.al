(module
  ;; completely naive memory mismanagement,
  ;; allocate memory but never reclaim it.
  (export alloc {fun (size) [block
    ;;start of free memory stored in free global
    (def free (get_global 0))
    ;; never alloc data at 0, because it looks like a null pointer.
    (set free (if (eq 0 free) 4 free))
    ;;move it forward, by the amount requested
    ;;also store at memory location 0
    (def _free (add free size))
    (i32_store 0 _free)
    (set_global 0 _free)
    ;;return the old position.
    free
  ]})
  ;;do nothing!
  (export free {fun (ptr) 0})
)
