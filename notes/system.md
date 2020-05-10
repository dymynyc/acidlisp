

## reads

wasm calls the system tell them you want data

  <- read_request (id, ptr, bytes)

system writes at most `bytes` at `ptr`

then calls

  -> read_ready (id, fd, ptr, bytes_written)

## writes

wasm calls the system, says there is data here.

  -> write_request (id, ptr, bytes)

system calls back

  <- write_ready (cb_id, fd, ptr, bytes)

## open a socket

open_requets with a pointer to a byte vector describing
the resource to open.

  <- open_request (ptr, bytes, cb)

  -> open_ready (cb)

  -> open_close (cb, code) // 0 for normal close
