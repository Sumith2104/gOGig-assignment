/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'tesseract.js', 'exifreader', 'image-hash'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'sharp', 'tesseract.js'];
    config.ignoreWarnings = [
      { module: /node_modules\/bullmq/ },
      /Can't resolve '@valkey\/valkey-glide'/,
    ];
    return config;
  },
};

module.exports = nextConfig;
