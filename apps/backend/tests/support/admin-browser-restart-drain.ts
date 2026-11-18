interface ResponseLifecycle {
  readonly writableFinished: boolean;
  once(event: "finish" | "close", listener: () => void): unknown;
}

// Test-server HTTP observations. A prematurely closed response cannot prove that
// its handler finished, even if the socket and browser request are already gone.
export function createRestartDrain() {
  let activeResponses = 0;
  let armed = false;
  let interrupted = false;

  return {
    track(response: ResponseLifecycle) {
      activeResponses++;
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        activeResponses--;
        if (armed && !response.writableFinished) interrupted = true;
      };
      response.once("finish", settle);
      response.once("close", settle);
    },
    arm() {
      if (armed || activeResponses !== 0) throw new Error("BACKEND_NOT_IDLE_AT_RESTART_BOUNDARY");
      armed = true;
    },
    reportUnexpectedError() {
      if (armed) interrupted = true;
    },
    assertDrained() {
      if (!armed || interrupted || activeResponses !== 0) throw new Error("BACKEND_RESTART_DRAIN_NOT_PROVEN");
    },
  };
}
