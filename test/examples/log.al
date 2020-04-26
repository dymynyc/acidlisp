(module
  (def log (system "system" "log" (string)))

  (export (fun () (log "hello world!!!\n")))
)
