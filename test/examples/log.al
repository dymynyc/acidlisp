(module
  (def log (system "system" "log" (string)))

  (export (fun (p) (log "hello world!!!")))
)
