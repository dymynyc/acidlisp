

add

i32 + i32 = i32
i32 + f32 = f64 (since a f32 can't contain a i32)
i32 + f64 = f64
i32 + i64 = i64

f32 + f32 = f32
f32 + f64 = f64
f32 + i64 = f64 (may loose lower bits)

f64 + f64 = f64
f64 + i64 = f64 (may loose lower bits)

i64 + i64 = i64

I was originally gonna make this fully staticically typed
(like C) but then I thought... if every struct has a pointer
to it's class. that's only 4 bytes extra per object.

and it gives you the ability to do many more things. I also
wanted it to "feel dynamic" and really you need to be able
to do run time checks for that.

the next idea
