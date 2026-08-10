/* Motion feature bundle, loaded ASYNCHRONOUSLY through <LazyMotion
   features={...}>: the 4.6kB `m` shell renders immediately and the ~15kB
   domAnimation chunk (variants, whileInView, exit animations, gestures)
   arrives without ever blocking first paint. domMax (drag + layout
   animations) is deliberately absent — layout animations measure with
   getBoundingClientRect every frame, exactly the thrash the frame
   scheduler exists to remove. See docs/research/MOTION-STACK-SPEC.md §1. */
import { domAnimation } from "motion/react";

export default domAnimation;
