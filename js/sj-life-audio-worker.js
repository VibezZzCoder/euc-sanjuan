/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Generates the city's sound material off the main thread and hands each finished sample array back (transferred).
// Message in: {rate}. Messages out: {key, samples} per job in job order, then {key: 'done', ms}; {key: 'error', message}.
import { lifeSoundJobs } from './sj-life-audio-synth.js';

self.onmessage = (event) => {
  const start = performance.now();
  try {
    const done = Object.create(null);
    for (const job of lifeSoundJobs(event.data.rate)) {
      let result = job.run(done);
      if (!(result instanceof Float32Array)) { let step; do step = result.next(); while (!step.done); result = step.value; }
      done[job.key] = result;
      // later jobs (the murmur) read earlier ones, so send a copy and keep the original here
      const copy = result.slice();
      self.postMessage({ key: job.key, samples: copy }, [copy.buffer]);
    }
    self.postMessage({ key: 'done', ms: performance.now() - start });
  } catch (error) {
    self.postMessage({ key: 'error', message: String(error?.message ?? error) });
  }
};
