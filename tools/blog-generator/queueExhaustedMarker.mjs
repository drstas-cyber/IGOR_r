// A single, deliberately tiny, zero-dependency module holding one
// constant: the stable sentinel text generate.mjs's `::error::` annotation
// uses when topics.json is exhausted, and checkGenerateFailureReason.mjs
// (the notification-hardening pass, 2026-08-31) matches on to name that
// specific, real cause from captured log text -- never a guess.
//
// Why its own file rather than living in generate.mjs (which already owns
// the annotation) or checkGenerateFailureReason.mjs (which already owns
// the detection): either direction would mean one of those two modules
// importing the OTHER just to share one string -- generate.mjs is heavy
// (Anthropic SDK client, execSync, the whole pipeline); the checker is
// deliberately light (see notificationEmail.mjs's own header comment on
// the same principle, Task 0 of this pass). A zero-dependency leaf module
// both can import avoids that inversion in either direction.
export const QUEUE_EXHAUSTED_MARKER = 'QUEUE EXHAUSTED';
