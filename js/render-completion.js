/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// SF Spin-off: EUC Thrills — © 2026 VibezZzCoder — MIT.
// Transition-only fence. Never serialize ordinary riding frames on GPU completion.
export async function waitForRenderCompletion(renderer) {
  if (renderer.backend.device) return renderer.backend.device.queue.onSubmittedWorkDone();
  const gl = renderer.backend.gl;
  if (!gl || gl.isContextLost()) throw new Error('Graphics context lost during map transition.');
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw new Error('Could not fence the map transition.');
  gl.flush();
  const deadline = performance.now() + 10000;
  try {
    for (;;) {
      if (gl.isContextLost()) throw new Error('Graphics context lost during map transition.');
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
      if (status === gl.WAIT_FAILED || performance.now() >= deadline) throw new Error('Map graphics completion failed.');
      await new Promise(resolve => setTimeout(resolve, 8));
    }
  } finally { gl.deleteSync(fence); }
}
