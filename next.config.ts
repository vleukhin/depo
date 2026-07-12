import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client тянет нативную часть (для локального file:) — держим её вне бандла сервера.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
