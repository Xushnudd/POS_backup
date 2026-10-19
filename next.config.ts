import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone',
  serverExternalPackages: ['exceljs'],
  async headers(){return [{source:'/pwa/:path*',headers:[{key:'Content-Security-Policy',value:"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},{key:'Content-Type',value:'application/javascript; charset=utf-8'},{key:'Content-Security-Policy',value:"default-src 'none'; script-src 'self'; connect-src 'self'"},{key:'X-Content-Type-Options',value:'nosniff'}]}];},
};

export default nextConfig;
