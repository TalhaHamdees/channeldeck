import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subdirectory of a larger repo whose root also holds a
  // lockfile. Pin the Turbopack root to *this* directory so module resolution
  // and file-system tracing stay inside the Mori app and don't pull in files
  // from the parent project.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
