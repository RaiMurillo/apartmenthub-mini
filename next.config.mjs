/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Server actions default to a 1 MB body limit. Applicants upload
      // documents of up to 5 MB, so we allow a little headroom.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
