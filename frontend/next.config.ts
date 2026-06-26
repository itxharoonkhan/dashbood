import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['genkit', '@genkit-ai/google-genai', '@genkit-ai/core'],
  webpack: (config) => {
    config.resolve.alias['@opentelemetry/exporter-jaeger'] = false
    config.resolve.alias['@genkit-ai/firebase'] = false
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
