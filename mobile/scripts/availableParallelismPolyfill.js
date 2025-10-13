const os = require("os");

if (typeof os.availableParallelism !== "function") {
  os.availableParallelism = function availableParallelismFallback() {
    const cpus = os.cpus?.();
    if (Array.isArray(cpus) && cpus.length > 0) {
      return cpus.length;
    }
    return 1;
  };
}
